import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mime from 'mime';
import { z } from 'zod';

import { fileEnv } from '@/envs/file';
import { getServerFileS3Config, type ServerFileS3Config } from '@/server/services/appSettings';
import { YEAR } from '@/utils/units';

export const fileSchema = z.object({
  Key: z.string(),
  LastModified: z.date(),
  Size: z.number(),
});

export const listFileSchema = z.array(fileSchema);

export type FileType = z.infer<typeof fileSchema>;

const DEFAULT_S3_REGION = 'us-east-1';
const PUBLIC_READ_ACL_HEADER = 'public-read';

export interface PreSignedUpload {
  headers?: Record<string, string>;
  url: string;
}

export class S3 {
  private readonly client: S3Client;

  private readonly bucket: string;

  private readonly setAcl: boolean;

  private readonly previewUrlExpireIn: number;

  constructor(
    accessKeyId: string | undefined,
    secretAccessKey: string | undefined,
    endpoint: string | undefined,
    options?: {
      bucket?: string;
      forcePathStyle?: boolean;
      previewUrlExpireIn?: number;
      region?: string;
      setAcl?: boolean;
    },
  ) {
    if (!accessKeyId || !secretAccessKey || !endpoint)
      throw new Error('S3 environment variables are not set completely, please check your env');
    if (!options?.bucket) throw new Error('S3 bucket is not set, please check your env');

    this.bucket = options?.bucket;
    this.setAcl = options?.setAcl || false;
    this.previewUrlExpireIn = options?.previewUrlExpireIn || fileEnv.S3_PREVIEW_URL_EXPIRE_IN;

    this.client = new S3Client({
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      endpoint,
      forcePathStyle: options?.forcePathStyle,
      region: options?.region || DEFAULT_S3_REGION,
      // refs: https://github.com/lobehub/lobe-chat/pull/5479
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  public async deleteFile(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return this.client.send(command);
  }

  public async deleteFiles(keys: string[]) {
    const command = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: { Objects: keys.map((key) => ({ Key: key })) },
    });

    return this.client.send(command);
  }

  public async getFileContent(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`No body in response with ${key}`);
    }

    return response.Body.transformToString();
  }

  public async getFileByteArray(key: string): Promise<Uint8Array> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`No body in response with ${key}`);
    }

    return response.Body.transformToByteArray();
  }

  /**
   * Get file metadata from S3 using HeadObject
   * This is used to verify actual file size from S3 instead of trusting client-provided values
   */
  public async getFileMetadata(
    key: string,
  ): Promise<{ contentLength: number; contentType?: string }> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    return {
      contentLength: response.ContentLength ?? 0,
      contentType: response.ContentType,
    };
  }

  public async testConnection() {
    const command = new HeadBucketCommand({
      Bucket: this.bucket,
    });

    await this.client.send(command);
  }

  public async createPreSignedUrl(key: string): Promise<string> {
    const upload = await this.createPreSignedUpload(key);
    return upload.url;
  }

  private async createPreSignedUploadWithAcl(
    key: string,
    acl?: typeof PUBLIC_READ_ACL_HEADER,
  ): Promise<PreSignedUpload> {
    const command = new PutObjectCommand({
      ACL: acl,
      Bucket: this.bucket,
      Key: key,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: 3600 });

    return {
      headers: acl ? { 'x-amz-acl': acl } : undefined,
      url,
    };
  }

  public async createPreSignedUpload(key: string): Promise<PreSignedUpload> {
    return this.createPreSignedUploadWithAcl(
      key,
      this.setAcl ? PUBLIC_READ_ACL_HEADER : undefined,
    );
  }

  public async createPrivatePreSignedUpload(key: string): Promise<PreSignedUpload> {
    return this.createPreSignedUploadWithAcl(key);
  }

  public async createPreSignedUrlForPreview(key: string, expiresIn?: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: expiresIn ?? this.previewUrlExpireIn,
    });
  }

  /**
   * Upload buffer with specified content type
   */
  public async uploadBuffer(
    path: string,
    buffer: Buffer,
    contentType?: string,
    cacheControl?: string,
  ) {
    const command = new PutObjectCommand({
      ACL: this.setAcl ? 'public-read' : undefined,
      Body: buffer,
      Bucket: this.bucket,
      CacheControl: cacheControl,
      ContentType: contentType,
      Key: path,
    });

    return this.client.send(command);
  }

  public async uploadContent(path: string, content: string) {
    const command = new PutObjectCommand({
      ACL: this.setAcl ? 'public-read' : undefined,
      Body: content,
      Bucket: this.bucket,
      Key: path,
    });

    return this.client.send(command);
  }

  /**
   * Upload media file (images only) with long-term cache
   */
  public async uploadMedia(key: string, buffer: Buffer) {
    const contentType = mime.getType(key) || 'application/octet-stream';
    const command = new PutObjectCommand({
      ACL: this.setAcl ? 'public-read' : undefined,
      Body: buffer,
      Bucket: this.bucket,
      CacheControl: `public, max-age=${YEAR}`,
      ContentType: contentType,
      Key: key,
    });

    await this.client.send(command);
  }
}

type FileS3RuntimeCache = {
  cacheKey: string;
  expiresAt: number;
  s3: S3;
};

let fileS3RuntimeCache: FileS3RuntimeCache | null = null;
const FILE_S3_RUNTIME_CACHE_TTL_MS = 30_000;

const createFileS3RuntimeCacheKey = (config: ServerFileS3Config) =>
  JSON.stringify([
    config.accessKeyId ?? '',
    config.secretAccessKey ?? '',
    config.endpoint ?? '',
    config.bucket ?? '',
    config.enablePathStyle,
    config.previewUrlExpireIn,
    config.region ?? '',
    config.setAcl,
  ]);

export const invalidateFileS3RuntimeCache = () => {
  fileS3RuntimeCache = null;
};

export class FileS3 extends S3 {
  private runtimeS3?: S3;

  private readonly staticConfig?: ServerFileS3Config;

  constructor(config?: Partial<ServerFileS3Config>) {
    const envConfig: ServerFileS3Config = {
      accessKeyId: fileEnv.S3_ACCESS_KEY_ID,
      bucket: fileEnv.S3_BUCKET,
      enablePathStyle: fileEnv.S3_ENABLE_PATH_STYLE,
      endpoint: fileEnv.S3_ENDPOINT,
      filePath: fileEnv.NEXT_PUBLIC_S3_FILE_PATH || 'files',
      previewUrlExpireIn: fileEnv.S3_PREVIEW_URL_EXPIRE_IN,
      publicDomain: fileEnv.S3_PUBLIC_DOMAIN,
      region: fileEnv.S3_REGION,
      secretAccessKey: fileEnv.S3_SECRET_ACCESS_KEY,
      setAcl: fileEnv.S3_SET_ACL,
    };
    const initialConfig = { ...envConfig, ...config };

    super(
      initialConfig.accessKeyId || '__pending_access_key__',
      initialConfig.secretAccessKey || '__pending_secret_key__',
      initialConfig.endpoint || 'http://localhost',
      {
        bucket: initialConfig.bucket || '__pending_bucket__',
        forcePathStyle: initialConfig.enablePathStyle,
        previewUrlExpireIn: initialConfig.previewUrlExpireIn,
        region: initialConfig.region,
        setAcl: initialConfig.setAcl,
      },
    );

    this.staticConfig = config ? initialConfig : undefined;
  }

  public async getConfig(): Promise<ServerFileS3Config> {
    return this.staticConfig ?? getServerFileS3Config();
  }

  private createS3FromConfig(config: ServerFileS3Config) {
    return new S3(config.accessKeyId, config.secretAccessKey, config.endpoint, {
      bucket: config.bucket,
      forcePathStyle: config.enablePathStyle,
      previewUrlExpireIn: config.previewUrlExpireIn,
      region: config.region,
      setAcl: config.setAcl,
    });
  }

  private async getRuntimeS3() {
    if (this.staticConfig) {
      this.runtimeS3 ??= this.createS3FromConfig(this.staticConfig);
      return this.runtimeS3;
    }

    const now = Date.now();
    if (fileS3RuntimeCache && fileS3RuntimeCache.expiresAt > now) {
      return fileS3RuntimeCache.s3;
    }

    const config = await this.getConfig();
    const cacheKey = createFileS3RuntimeCacheKey(config);

    if (fileS3RuntimeCache?.cacheKey === cacheKey && fileS3RuntimeCache.expiresAt > now) {
      return fileS3RuntimeCache.s3;
    }

    const s3 = this.createS3FromConfig(config);
    fileS3RuntimeCache = { cacheKey, expiresAt: now + FILE_S3_RUNTIME_CACHE_TTL_MS, s3 };

    return s3;
  }

  public async deleteFile(key: string) {
    return (await this.getRuntimeS3()).deleteFile(key);
  }

  public async deleteFiles(keys: string[]) {
    return (await this.getRuntimeS3()).deleteFiles(keys);
  }

  public async getFileContent(key: string): Promise<string> {
    return (await this.getRuntimeS3()).getFileContent(key);
  }

  public async getFileByteArray(key: string): Promise<Uint8Array> {
    return (await this.getRuntimeS3()).getFileByteArray(key);
  }

  public async getFileMetadata(
    key: string,
  ): Promise<{ contentLength: number; contentType?: string }> {
    return (await this.getRuntimeS3()).getFileMetadata(key);
  }

  public async createPreSignedUrl(key: string): Promise<string> {
    return (await this.getRuntimeS3()).createPreSignedUrl(key);
  }

  public async createPreSignedUpload(key: string): Promise<PreSignedUpload> {
    return (await this.getRuntimeS3()).createPreSignedUpload(key);
  }

  public async createPrivatePreSignedUpload(key: string): Promise<PreSignedUpload> {
    return (await this.getRuntimeS3()).createPrivatePreSignedUpload(key);
  }

  public async testConnection() {
    return (await this.getRuntimeS3()).testConnection();
  }

  public async createPreSignedUrlForPreview(key: string, expiresIn?: number): Promise<string> {
    return (await this.getRuntimeS3()).createPreSignedUrlForPreview(key, expiresIn);
  }

  public async uploadBuffer(
    path: string,
    buffer: Buffer,
    contentType?: string,
    cacheControl?: string,
  ) {
    return (await this.getRuntimeS3()).uploadBuffer(path, buffer, contentType, cacheControl);
  }

  public async uploadContent(path: string, content: string) {
    return (await this.getRuntimeS3()).uploadContent(path, content);
  }

  public async uploadMedia(key: string, buffer: Buffer) {
    return (await this.getRuntimeS3()).uploadMedia(key, buffer);
  }
}

export class EnvFileS3 extends S3 {
  constructor() {
    super(fileEnv.S3_ACCESS_KEY_ID, fileEnv.S3_SECRET_ACCESS_KEY, fileEnv.S3_ENDPOINT, {
      bucket: fileEnv.S3_BUCKET,
      forcePathStyle: fileEnv.S3_ENABLE_PATH_STYLE,
      previewUrlExpireIn: fileEnv.S3_PREVIEW_URL_EXPIRE_IN,
      region: fileEnv.S3_REGION,
      setAcl: fileEnv.S3_SET_ACL,
    });
  }
}
