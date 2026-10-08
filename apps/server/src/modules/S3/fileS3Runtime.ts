import { fileEnv } from '@/envs/file';
import { getServerFileS3Config, type ServerFileS3Config } from '@/server/services/appSettings';

import { type PreSignedUpload, S3 } from './s3Client';

type FileS3RuntimeCache = {
  cacheKey: string;
  expiresAt: number;
  s3: S3;
};

let fileS3RuntimeCache: FileS3RuntimeCache | null = null;
let fileS3RuntimeCacheGeneration = 0;
const FILE_S3_RUNTIME_CACHE_TTL_MS = 30_000;

const createFileS3RuntimeCacheKey = (config: ServerFileS3Config) =>
  JSON.stringify([
    config.accessKeyId ?? '',
    config.secretAccessKey ?? '',
    config.endpoint ?? '',
    config.internalEndpoint ?? '',
    config.bucket ?? '',
    config.enablePathStyle,
    config.previewUrlExpireIn,
    config.region ?? '',
    config.setAcl,
  ]);

export const invalidateFileS3RuntimeCache = () => {
  fileS3RuntimeCacheGeneration += 1;
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
      internalEndpoint: fileEnv.S3_INTERNAL_ENDPOINT,
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
        internalEndpoint: initialConfig.internalEndpoint,
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
      internalEndpoint: config.internalEndpoint,
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

    const generation = fileS3RuntimeCacheGeneration;
    const config = await this.getConfig();
    const cacheKey = createFileS3RuntimeCacheKey(config);

    if (fileS3RuntimeCache?.cacheKey === cacheKey && fileS3RuntimeCache.expiresAt > now) {
      return fileS3RuntimeCache.s3;
    }

    const s3 = this.createS3FromConfig(config);
    if (generation === fileS3RuntimeCacheGeneration) {
      fileS3RuntimeCache = { cacheKey, expiresAt: now + FILE_S3_RUNTIME_CACHE_TTL_MS, s3 };
    }

    return s3;
  }

  public async deleteFile(key: string) {
    return (await this.getRuntimeS3()).deleteFile(key);
  }

  public async deleteFiles(keys: string[]) {
    return (await this.getRuntimeS3()).deleteFiles(keys);
  }

  public async getFileContent(key: string, byteLength?: number): Promise<string> {
    return (await this.getRuntimeS3()).getFileContent(key, byteLength);
  }

  public async getFileByteArray(key: string): Promise<Uint8Array> {
    return (await this.getRuntimeS3()).getFileByteArray(key);
  }

  public async getFileMetadata(
    key: string,
  ): Promise<{ contentLength: number; contentType?: string }> {
    return (await this.getRuntimeS3()).getFileMetadata(key);
  }

  public async createPreSignedUrl(key: string, contentLength?: number): Promise<string> {
    return (await this.getRuntimeS3()).createPreSignedUrl(key, contentLength);
  }

  public async createPreSignedUpload(
    key: string,
    contentLength?: number,
  ): Promise<PreSignedUpload> {
    return (await this.getRuntimeS3()).createPreSignedUpload(key, contentLength);
  }

  public async createPrivatePreSignedUpload(
    key: string,
    contentLength?: number,
  ): Promise<PreSignedUpload> {
    return (await this.getRuntimeS3()).createPrivatePreSignedUpload(key, contentLength);
  }

  public async createMultipartUpload(key: string, contentType?: string): Promise<string> {
    return (await this.getRuntimeS3()).createMultipartUpload(key, contentType);
  }

  public async createPreSignedUploadPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    contentLength?: number,
  ): Promise<string> {
    return (await this.getRuntimeS3()).createPreSignedUploadPartUrl(
      key,
      uploadId,
      partNumber,
      contentLength,
    );
  }

  public async completeMultipartUpload(
    key: string,
    uploadId: string,
    expectedPartCount: number,
    uploadedParts?: Array<{ ETag: string; PartNumber: number }>,
    expectedFile?: { partSize: number; size: number },
  ) {
    return (await this.getRuntimeS3()).completeMultipartUpload(
      key,
      uploadId,
      expectedPartCount,
      uploadedParts,
      expectedFile,
    );
  }

  public async abortMultipartUpload(key: string, uploadId: string) {
    return (await this.getRuntimeS3()).abortMultipartUpload(key, uploadId);
  }

  public async testConnection() {
    return (await this.getRuntimeS3()).testConnection();
  }

  public async createPreSignedUrlForPreview(key: string, expiresIn?: number): Promise<string> {
    return (await this.getRuntimeS3()).createPreSignedUrlForPreview(key, expiresIn);
  }

  public async createPreSignedUrlForDownload(
    key: string,
    fileName: string,
    expiresIn?: number,
  ): Promise<string> {
    return (await this.getRuntimeS3()).createPreSignedUrlForDownload(key, fileName, expiresIn);
  }

  public async uploadBuffer(
    path: string,
    buffer: Buffer,
    contentType?: string,
    cacheControl?: string,
    options?: { abortSignal?: AbortSignal; ifMatch?: string },
  ) {
    return (await this.getRuntimeS3()).uploadBuffer(
      path,
      buffer,
      contentType,
      cacheControl,
      options,
    );
  }

  public async uploadPrivateBuffer(path: string, buffer: Buffer, contentType?: string) {
    return (await this.getRuntimeS3()).uploadPrivateBuffer(path, buffer, contentType);
  }

  public async uploadPrivateBufferIfAbsent(path: string, buffer: Buffer, contentType?: string) {
    return (await this.getRuntimeS3()).uploadPrivateBufferIfAbsent(path, buffer, contentType);
  }

  public async uploadContent(path: string, content: string) {
    return (await this.getRuntimeS3()).uploadContent(path, content);
  }

  public async uploadMedia(key: string, buffer: Buffer) {
    return (await this.getRuntimeS3()).uploadMedia(key, buffer);
  }
}
