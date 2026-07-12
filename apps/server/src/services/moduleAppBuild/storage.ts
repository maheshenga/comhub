import { createHash } from 'node:crypto';

import type { ModuleAppBuildProfile } from '@lobechat/types';

import { FileS3 } from '@/server/modules/S3';

import type { ModuleAppBuildWorkerRequest } from './contracts';

const MODULE_APP_BUILD_URL_EXPIRES_IN_SECONDS = 15 * 60;
const MODULE_APP_BUILD_MAX_ARTIFACT_BYTES = 256 * 1024 * 1024;

export type ModuleAppBuildStorage = Pick<
  FileS3,
  | 'createPreSignedUpload'
  | 'createPreSignedUrlForPreview'
  | 'deleteFile'
  | 'getFileByteArray'
  | 'getFileMetadata'
  | 'uploadBuffer'
>;

export type ClaimedModuleAppBuild = {
  buildProfile: ModuleAppBuildProfile;
  id: string;
  sourceSha256: string;
  sourceStorageKey: string;
};

type StoredModuleAppBuild = Omit<ClaimedModuleAppBuild, 'sourceStorageKey'>;

export class ModuleAppBuildStorageError extends Error {
  constructor(
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(code);
    this.name = 'ModuleAppBuildStorageError';
  }
}

export const getModuleAppBuildStagingKey = (buildId: string) =>
  `module-app-build-staging/${buildId}.tgz`;

export const getModuleAppBuildArtifactKey = (buildId: string, artifactSha256: string) =>
  `module-app-builds/${buildId}/${artifactSha256}.tgz`;

export class ModuleAppBuildStorageService {
  private readonly storage: ModuleAppBuildStorage;

  constructor(options: { storage?: ModuleAppBuildStorage } = {}) {
    this.storage = options.storage ?? new FileS3();
  }

  prepareWorkerRequest = async (
    build: ClaimedModuleAppBuild,
  ): Promise<Omit<ModuleAppBuildWorkerRequest, 'claimToken'>> => {
    const artifactKey = getModuleAppBuildStagingKey(build.id);
    const [sourceDownloadUrl, upload] = await Promise.all([
      this.storage.createPreSignedUrlForPreview(
        build.sourceStorageKey,
        MODULE_APP_BUILD_URL_EXPIRES_IN_SECONDS,
      ),
      this.storage.createPreSignedUpload(artifactKey),
    ]);

    return {
      artifactKey,
      buildId: build.id,
      buildProfile: build.buildProfile,
      sourceDownloadUrl,
      sourceSha256: build.sourceSha256,
      uploadHeaders: upload.headers ?? {},
      uploadUrl: upload.url,
    };
  };

  promoteVerifiedArtifact = async (input: {
    artifactKey: string;
    artifactSha256: string;
    build: StoredModuleAppBuild;
  }) => {
    const stagingKey = getModuleAppBuildStagingKey(input.build.id);
    if (input.artifactKey !== stagingKey) {
      throw new ModuleAppBuildStorageError('MODULE_APP_BUILD_ARTIFACT_KEY_MISMATCH');
    }
    if (!/^[a-f0-9]{64}$/.test(input.artifactSha256)) {
      throw new ModuleAppBuildStorageError('MODULE_APP_BUILD_ARTIFACT_HASH_INVALID');
    }

    const metadata = await this.storage.getFileMetadata(stagingKey).catch((error) => {
      throw new ModuleAppBuildStorageError('MODULE_APP_BUILD_ARTIFACT_NOT_FOUND', error);
    });
    if (
      metadata.contentLength <= 0 ||
      metadata.contentLength > MODULE_APP_BUILD_MAX_ARTIFACT_BYTES
    ) {
      throw new ModuleAppBuildStorageError('MODULE_APP_BUILD_ARTIFACT_SIZE_INVALID');
    }

    const bytes = await this.storage.getFileByteArray(stagingKey).catch((error) => {
      throw new ModuleAppBuildStorageError('MODULE_APP_BUILD_ARTIFACT_READ_FAILED', error);
    });
    if (bytes.byteLength !== metadata.contentLength) {
      throw new ModuleAppBuildStorageError('MODULE_APP_BUILD_ARTIFACT_SIZE_MISMATCH');
    }

    const artifactSha256 = createHash('sha256').update(bytes).digest('hex');
    if (artifactSha256 !== input.artifactSha256) {
      throw new ModuleAppBuildStorageError('MODULE_APP_BUILD_ARTIFACT_HASH_MISMATCH');
    }

    const artifactKey = getModuleAppBuildArtifactKey(input.build.id, artifactSha256);
    await this.storage
      .uploadBuffer(
        artifactKey,
        Buffer.from(bytes),
        'application/gzip',
        'private, max-age=31536000, immutable',
      )
      .catch((error) => {
        throw new ModuleAppBuildStorageError('MODULE_APP_BUILD_ARTIFACT_PROMOTION_FAILED', error);
      });

    await this.storage.deleteFile(stagingKey).catch(() => undefined);

    return { artifactKey, artifactSha256 };
  };
}
