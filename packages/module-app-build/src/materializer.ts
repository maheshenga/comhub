import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

import type { ModuleAppPackageManifest } from '@lobechat/types';
import { extract, type Headers } from 'tar-stream';

import { inspectModuleAppArtifact, type ModuleAppArtifactEntry } from './artifact';

type ManifestV2 = Extract<ModuleAppPackageManifest, { manifestVersion: 2 }>;

type ArtifactMarker = {
  artifactSha256: string;
  buildId: string;
  manifestSha256: string;
  schemaVersion: 1;
};

export type MaterializeModuleAppArtifactInput = {
  artifactBytes: Uint8Array;
  artifactRoot: string;
  artifactSha256: string;
  buildId: string;
  claimToken: string;
  manifest: ManifestV2;
};

export class ModuleAppArtifactMaterializationError extends Error {
  constructor(
    public readonly code: string,
    message = code,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ModuleAppArtifactMaterializationError';
  }
}

const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
};

const getManifestSha256 = (manifest: ManifestV2) =>
  sha256(JSON.stringify(canonicalize(manifest)));

const isSafePath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('\0')) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) return false;
  if (/^[a-z]:[\\/]/i.test(trimmed) || trimmed.includes('\\')) return false;
  return !trimmed.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');
};

const assertSafeIdentity = (value: string, label: string) => {
  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new ModuleAppArtifactMaterializationError(
      'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_INVALID',
      `Unsafe ${label}.`,
    );
  }
};

const resolveEntryPath = (root: string, entryPath: string) => {
  if (!isSafePath(entryPath)) {
    throw new ModuleAppArtifactMaterializationError(
      'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_INVALID',
      `Unsafe artifact path: ${entryPath}`,
    );
  }
  const resolved = path.resolve(root, ...entryPath.split('/'));
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (!resolved.startsWith(prefix)) {
    throw new ModuleAppArtifactMaterializationError(
      'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_INVALID',
      `Unsafe artifact path: ${entryPath}`,
    );
  }
  return resolved;
};

const syncFile = async (filePath: string) => {
  const handle = await open(filePath, 'r+');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
};

const syncDirectory = async (directory: string) => {
  let handle;
  try {
    handle = await open(directory, 'r');
    await handle.sync();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!['EBADF', 'EINVAL', 'EISDIR', 'ENOTSUP', 'EPERM'].includes(code ?? '')) throw error;
  } finally {
    await handle?.close();
  }
};

const extractArtifact = async (artifactBytes: Uint8Array, stagingDirectory: string) =>
  new Promise<void>((resolve, reject) => {
    const input = Readable.from([Buffer.from(artifactBytes)]);
    const gunzip = createGunzip();
    const archive = extract();
    let settled = false;

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      input.destroy();
      gunzip.destroy();
      archive.destroy();
      reject(error);
    };

    input.once('error', fail);
    gunzip.once('error', fail);
    archive.once('error', fail);
    archive.once('finish', () => {
      if (settled) return;
      settled = true;
      resolve();
    });

    archive.on('entry', (header: Headers, stream, next) => {
      void (async () => {
        if (header.type !== 'file' && header.type !== 'directory') {
          throw new ModuleAppArtifactMaterializationError(
            'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_INVALID',
            `Unsupported artifact entry: ${header.type ?? 'unknown'}`,
          );
        }
        const destination = resolveEntryPath(stagingDirectory, header.name);
        if (header.type === 'directory') {
          await mkdir(destination, { recursive: true });
          stream.resume();
          await new Promise<void>((entryResolve, entryReject) => {
            stream.once('end', entryResolve);
            stream.once('error', entryReject);
          });
          next();
          return;
        }

        await mkdir(path.dirname(destination), { recursive: true });
        await pipeline(stream, createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
        await syncFile(destination);
        next();
      })().catch(fail);
    });

    input.pipe(gunzip).pipe(archive);
  });

const declaredRegularFiles = (manifest: ManifestV2) => {
  const frontendOutput = manifest.build.frontend.output;
  const frontendFile = frontendOutput.toLowerCase().endsWith('.html')
    ? frontendOutput
    : `${frontendOutput}/index.html`;
  return [frontendFile, ...manifest.runtime.functions.map((runtimeFunction) => runtimeFunction.entry)];
};

const assertDeclaredRegularFiles = async (directory: string, manifest: ManifestV2) => {
  for (const declaredPath of declaredRegularFiles(manifest)) {
    let metadata;
    try {
      metadata = await lstat(resolveEntryPath(directory, declaredPath));
    } catch (error) {
      throw new ModuleAppArtifactMaterializationError(
        'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_INVALID',
        `Declared artifact file is missing: ${declaredPath}`,
        error,
      );
    }
    if (!metadata.isFile()) {
      throw new ModuleAppArtifactMaterializationError(
        'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_INVALID',
        `Declared artifact path is not a regular file: ${declaredPath}`,
      );
    }
  }
};

const validateExistingDestination = async (
  directory: string,
  marker: ArtifactMarker,
  manifest: ManifestV2,
) => {
  try {
    if (!(await lstat(directory)).isDirectory()) return false;
    const markerPath = path.join(directory, '.module-app-artifact.json');
    if (!(await lstat(markerPath)).isFile()) return false;
    const existing = JSON.parse(await readFile(markerPath, 'utf8')) as Partial<ArtifactMarker>;
    if (
      existing.schemaVersion !== 1 ||
      existing.artifactSha256 !== marker.artifactSha256 ||
      existing.buildId !== marker.buildId ||
      existing.manifestSha256 !== marker.manifestSha256
    ) {
      return false;
    }
    await assertDeclaredRegularFiles(directory, manifest);
    return true;
  } catch {
    return false;
  }
};

const collectDirectories = (entries: ModuleAppArtifactEntry[], stagingDirectory: string) => {
  const directories = new Set([stagingDirectory]);
  for (const entry of entries) {
    const destination = resolveEntryPath(stagingDirectory, entry.path);
    if (entry.type === 'directory') directories.add(destination);
    let current = path.dirname(destination);
    while (current.startsWith(`${stagingDirectory}${path.sep}`)) {
      directories.add(current);
      current = path.dirname(current);
    }
  }
  return Array.from(directories).sort((left, right) => right.length - left.length);
};

const makeImmutable = async (
  entries: ModuleAppArtifactEntry[],
  stagingDirectory: string,
  markerPath: string,
) => {
  for (const entry of entries) {
    if (entry.type === 'file') await chmod(resolveEntryPath(stagingDirectory, entry.path), 0o444);
  }
  await chmod(markerPath, 0o444);

  for (const directory of collectDirectories(entries, stagingDirectory)) {
    await syncDirectory(directory);
    await chmod(directory, 0o555);
  }
};

const makeDirectoriesWritable = async (directory: string): Promise<void> => {
  const metadata = await lstat(directory).catch(() => undefined);
  if (!metadata?.isDirectory()) return;
  await chmod(directory, 0o755).catch(() => undefined);
  const children = await readdir(directory, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    children
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => makeDirectoriesWritable(path.join(directory, entry.name))),
  );
};

const removeOwnedDirectory = async (directory: string) => {
  try {
    await rm(directory, { force: true, recursive: true });
  } catch {
    await makeDirectoriesWritable(directory);
    await rm(directory, { force: true, recursive: true });
  }
};

export const materializeModuleAppArtifact = async (
  input: MaterializeModuleAppArtifactInput,
): Promise<{ directory: string; reused: boolean }> => {
  const artifactSha256 = input.artifactSha256.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(artifactSha256) || sha256(input.artifactBytes) !== artifactSha256) {
    throw new ModuleAppArtifactMaterializationError('MODULE_APP_BUILD_ARTIFACT_HASH_MISMATCH');
  }
  assertSafeIdentity(input.buildId, 'build ID');
  assertSafeIdentity(input.claimToken, 'claim token');

  const artifactRoot = path.resolve(input.artifactRoot);
  const stagingDirectory = path.join(
    artifactRoot,
    '.staging',
    `${input.buildId}-${input.claimToken}`,
  );
  const directory = path.join(artifactRoot, artifactSha256);
  const marker: ArtifactMarker = {
    artifactSha256,
    buildId: input.buildId,
    manifestSha256: getManifestSha256(input.manifest),
    schemaVersion: 1,
  };

  if (await lstat(directory).then(() => true).catch(() => false)) {
    if (await validateExistingDestination(directory, marker, input.manifest)) {
      return { directory, reused: true };
    }
    throw new ModuleAppArtifactMaterializationError(
      'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_MISMATCH',
    );
  }

  await mkdir(path.dirname(stagingDirectory), { recursive: true });
  await removeOwnedDirectory(stagingDirectory);

  try {
    const entries = await inspectModuleAppArtifact(input.artifactBytes);
    await mkdir(stagingDirectory, { recursive: true });
    await extractArtifact(input.artifactBytes, stagingDirectory);

    for (const entry of entries) {
      const metadata = await lstat(resolveEntryPath(stagingDirectory, entry.path));
      if (
        (entry.type === 'file' && !metadata.isFile()) ||
        (entry.type === 'directory' && !metadata.isDirectory())
      ) {
        throw new ModuleAppArtifactMaterializationError(
          'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_INVALID',
          `Artifact entry type changed during extraction: ${entry.path}`,
        );
      }
    }
    await assertDeclaredRegularFiles(stagingDirectory, input.manifest);

    const markerPath = path.join(stagingDirectory, '.module-app-artifact.json');
    await writeFile(markerPath, `${JSON.stringify(marker)}\n`, { flag: 'wx', mode: 0o600 });
    await syncFile(markerPath);
    await makeImmutable(entries, stagingDirectory, markerPath);

    try {
      await rename(stagingDirectory, directory);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EEXIST' || code === 'ENOTEMPTY') {
        if (await validateExistingDestination(directory, marker, input.manifest)) {
          await removeOwnedDirectory(stagingDirectory);
          return { directory, reused: true };
        }
        throw new ModuleAppArtifactMaterializationError(
          'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_MISMATCH',
          'Existing materialized artifact does not match the requested identity.',
          error,
        );
      }
      throw error;
    }
    try {
      await syncDirectory(artifactRoot);
    } catch (error) {
      await removeOwnedDirectory(directory);
      await syncDirectory(artifactRoot).catch(() => undefined);
      throw error;
    }
    return { directory, reused: false };
  } catch (error) {
    await removeOwnedDirectory(stagingDirectory);
    throw error;
  }
};
