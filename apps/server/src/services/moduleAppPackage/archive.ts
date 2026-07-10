import { createHash } from 'node:crypto';

import {
  MODULE_APP_PACKAGE_MAX_ARCHIVE_BYTES,
  moduleAppPackageManifestSchema,
  type ModuleAppPackageSubmitInput,
} from '@lobechat/types';
import { unzip } from 'fflate';

import { validateModuleAppPackageSubmission } from '@/business/server/module-apps/packageManifest';

const DEFAULT_LIMITS = {
  maxCompressionRatio: 200,
  maxFileCount: 1000,
  maxFileSizeBytes: 25 * 1024 * 1024,
  maxManifestBytes: 256 * 1024,
  maxPackageSizeBytes: MODULE_APP_PACKAGE_MAX_ARCHIVE_BYTES,
  maxUncompressedBytes: 100 * 1024 * 1024,
};

export type ModuleAppPackageArchiveLimits = Partial<typeof DEFAULT_LIMITS>;

export class ModuleAppPackageArchiveError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ModuleAppPackageArchiveError';
  }
}

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

const isUnsafePath = (path: string) => {
  const trimmed = path.trim();
  if (!trimmed || trimmed.includes('\0')) return true;
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) return true;
  if (/^[a-z]:[\\/]/i.test(trimmed) || trimmed.includes('\\')) return true;

  return trimmed.split('/').some((segment) => segment === '..' || segment === '');
};

const unzipPackage = (
  bytes: Uint8Array,
  limits: typeof DEFAULT_LIMITS,
): Promise<Record<string, Uint8Array>> =>
  new Promise((resolve, reject) => {
    let fileCount = 0;
    let totalUncompressedBytes = 0;
    let validationError: ModuleAppPackageArchiveError | undefined;
    const seenPaths = new Set<string>();

    unzip(
      bytes,
      {
        filter: (file) => {
          if (validationError || file.name.endsWith('/')) return false;

          fileCount += 1;
          totalUncompressedBytes += file.originalSize;

          if (isUnsafePath(file.name)) {
            validationError = new ModuleAppPackageArchiveError(
              'module_app_package_unsafe_path',
              `Unsafe package path: ${file.name}`,
            );
            return false;
          }

          if (seenPaths.has(file.name)) {
            validationError = new ModuleAppPackageArchiveError(
              'module_app_package_duplicate_path',
              `Duplicate package path: ${file.name}`,
            );
            return false;
          }
          seenPaths.add(file.name);

          if (fileCount > limits.maxFileCount) {
            validationError = new ModuleAppPackageArchiveError(
              'module_app_package_too_many_files',
              `Package contains more than ${limits.maxFileCount} files.`,
            );
            return false;
          }

          if (file.originalSize > limits.maxFileSizeBytes) {
            validationError = new ModuleAppPackageArchiveError(
              'module_app_package_file_too_large',
              `Package file exceeds ${limits.maxFileSizeBytes} bytes: ${file.name}`,
            );
            return false;
          }

          if (totalUncompressedBytes > limits.maxUncompressedBytes) {
            validationError = new ModuleAppPackageArchiveError(
              'module_app_package_expanded_too_large',
              `Expanded package exceeds ${limits.maxUncompressedBytes} bytes.`,
            );
            return false;
          }

          const compressionRatio = file.size === 0 ? file.originalSize : file.originalSize / file.size;
          if (compressionRatio > limits.maxCompressionRatio) {
            validationError = new ModuleAppPackageArchiveError(
              'module_app_package_compression_ratio_exceeded',
              `Package file compression ratio is too high: ${file.name}`,
            );
            return false;
          }

          return true;
        },
      },
      (error, files) => {
        if (validationError) {
          reject(validationError);
          return;
        }
        if (error) {
          reject(
            new ModuleAppPackageArchiveError(
              'module_app_package_archive_invalid',
              'Package archive could not be decompressed.',
            ),
          );
          return;
        }

        resolve(files);
      },
    );
  });

export const parseModuleAppPackageArchive = async (
  input: {
    bytes: Uint8Array;
    fileName: string;
    mimeType: ModuleAppPackageSubmitInput['archive']['mimeType'];
    storageKey: string;
  },
  overrides: ModuleAppPackageArchiveLimits = {},
): Promise<ModuleAppPackageSubmitInput> => {
  const limits = { ...DEFAULT_LIMITS, ...overrides };

  if (input.bytes.byteLength === 0 || input.bytes.byteLength > limits.maxPackageSizeBytes) {
    throw new ModuleAppPackageArchiveError(
      'module_app_package_archive_too_large',
      `Package archive must be between 1 and ${limits.maxPackageSizeBytes} bytes.`,
    );
  }

  const files = await unzipPackage(input.bytes, limits);
  const manifestBytes = files['manifest.json'];
  if (!manifestBytes) {
    throw new ModuleAppPackageArchiveError(
      'module_app_package_manifest_missing',
      'Package must contain a root manifest.json file.',
    );
  }
  if (manifestBytes.byteLength > limits.maxManifestBytes) {
    throw new ModuleAppPackageArchiveError(
      'module_app_package_manifest_too_large',
      `manifest.json exceeds ${limits.maxManifestBytes} bytes.`,
    );
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
  } catch {
    throw new ModuleAppPackageArchiveError(
      'module_app_package_manifest_invalid_json',
      'manifest.json must contain valid UTF-8 JSON.',
    );
  }

  const parsedManifest = moduleAppPackageManifestSchema.safeParse(manifest);
  if (!parsedManifest.success) {
    throw new ModuleAppPackageArchiveError(
      'module_app_package_manifest_invalid',
      'manifest.json does not match the Module App manifest schema.',
    );
  }

  const submission: ModuleAppPackageSubmitInput = {
    archive: {
      fileName: input.fileName,
      mimeType: input.mimeType,
      sha256: sha256(input.bytes),
      sizeBytes: input.bytes.byteLength,
      storageKey: input.storageKey,
    },
    fileManifest: Object.entries(files)
      .map(([path, data]) => ({ path, sha256: sha256(data), sizeBytes: data.byteLength }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    manifest: parsedManifest.data,
  };
  const validation = validateModuleAppPackageSubmission(submission, {
    maxFileCount: limits.maxFileCount,
    maxFileSizeBytes: limits.maxFileSizeBytes,
    maxPackageSizeBytes: limits.maxPackageSizeBytes,
  });

  if (!validation.ok) {
    const issue = validation.issues.find(({ severity }) => severity === 'error');
    throw new ModuleAppPackageArchiveError(
      issue?.code ?? 'module_app_package_validation_failed',
      issue?.message ?? 'Package validation failed.',
    );
  }

  return submission;
};
