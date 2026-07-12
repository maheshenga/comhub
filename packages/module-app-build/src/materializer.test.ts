import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import {
  buildDeterministicModuleAppArtifact,
  materializeModuleAppArtifact,
} from '@lobechat/module-app-build';
import {
  type ModuleAppPackageManifest,
  moduleAppPackageManifestV2Schema,
} from '@lobechat/types';
import { type Headers, type Pack,pack } from 'tar-stream';
import { afterEach, describe, expect, it } from 'vitest';

type ManifestV2 = Extract<ModuleAppPackageManifest, { manifestVersion: 2 }>;

const BUILD_ID = '00000000-0000-4000-8000-000000000001';
const CLAIM_TOKEN = 'claim-token-1';
const roots: string[] = [];
const encoder = new TextEncoder();

const manifest = moduleAppPackageManifestV2Schema.parse({
  app: {
    actions: [],
    appType: 'hybrid_app',
    billing: {},
    category: 'business',
    description: 'A materialized executable package.',
    displayName: 'Materialized Package',
    icon: 'Package',
    pages: [],
    slug: 'materialized-package',
    tags: [],
  },
  build: { frontend: { output: 'dist', profile: 'node22-static' } },
  entitlements: [],
  manifestVersion: 2,
  packageVersion: '1.0.0',
  runtime: {
    functions: [{ entry: 'server/index.js', key: 'main', runtime: 'node22' }],
    permissions: [],
  },
}) as ManifestV2;

const files = {
  'dist/index.html': encoder.encode('<main>Materialized</main>'),
  'server/index.js': encoder.encode('export default () => ({ ok: true });'),
};

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const createRoot = async () => {
  const root = path.join(os.tmpdir(), `module-app-materializer-${crypto.randomUUID()}`);
  roots.push(root);
  await mkdir(root, { recursive: true });
  return root;
};

const addTarEntry = (archive: Pack, header: Headers, bytes?: Uint8Array) =>
  new Promise<void>((resolve, reject) => {
    archive.entry(header, Buffer.from(bytes ?? new Uint8Array()), (error) => {
      if (error) return reject(error);
      resolve();
    });
  });

const createTgz = async (entries: Array<Headers & { bytes?: Uint8Array }>) => {
  const archive = pack();
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));
  const tarBytes = await new Promise<Buffer>((resolve, reject) => {
    archive.once('error', reject);
    archive.once('end', () => resolve(Buffer.concat(chunks)));
    void (async () => {
      try {
        for (const { bytes, ...header } of entries) {
          await addTarEntry(
            archive,
            header.type === ('socket' as Headers['type']) ? { ...header, type: 'file' } : header,
            bytes,
          );
        }
        archive.finalize();
      } catch (error) {
        archive.destroy(error instanceof Error ? error : new Error('fixture failed'));
      }
    })();
  });
  if (entries.some((entry) => entry.type === ('socket' as Headers['type']))) {
    tarBytes.fill(0x20, 148, 156);
    tarBytes[156] = '8'.charCodeAt(0);
    const checksum = tarBytes.subarray(0, 512).reduce((sum, value) => sum + value, 0);
    Buffer.from(checksum.toString(8).padStart(6, '0')).copy(tarBytes, 148);
    tarBytes[154] = 0;
    tarBytes[155] = 0x20;
  }
  return new Uint8Array(gzipSync(tarBytes));
};

const materialize = async (artifactRoot: string, artifactBytes: Uint8Array, inputManifest = manifest) =>
  materializeModuleAppArtifact({
    artifactBytes,
    artifactRoot,
    artifactSha256: sha256(artifactBytes),
    buildId: BUILD_ID,
    claimToken: CLAIM_TOKEN,
    manifest: inputManifest,
  });

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe('materializeModuleAppArtifact', () => {
  it('extracts through claim staging, writes identity marker, and applies read-only modes', async () => {
    const artifactRoot = await createRoot();
    const artifact = await buildDeterministicModuleAppArtifact({ files });

    await expect(materialize(artifactRoot, artifact.bytes)).resolves.toEqual({
      directory: path.join(artifactRoot, artifact.sha256),
      reused: false,
    });

    const directory = path.join(artifactRoot, artifact.sha256);
    expect(await readFile(path.join(directory, 'dist/index.html'), 'utf8')).toContain('Materialized');
    expect(JSON.parse(await readFile(path.join(directory, '.module-app-artifact.json'), 'utf8'))).toEqual(
      expect.objectContaining({
        artifactSha256: artifact.sha256,
        buildId: BUILD_ID,
        manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        schemaVersion: 1,
      }),
    );
    expect((await stat(directory)).mode & 0o777).toBe(process.platform === 'win32' ? 0o444 : 0o555);
    expect((await stat(path.join(directory, 'dist/index.html'))).mode & 0o777).toBe(0o444);
    await expect(lstat(path.join(artifactRoot, '.staging', `${BUILD_ID}-${CLAIM_TOKEN}`))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('removes interrupted claim staging before a fresh atomic materialization', async () => {
    const artifactRoot = await createRoot();
    const staging = path.join(artifactRoot, '.staging', `${BUILD_ID}-${CLAIM_TOKEN}`);
    await mkdir(staging, { recursive: true });
    await writeFile(path.join(staging, 'partial.txt'), 'partial');
    const artifact = await buildDeterministicModuleAppArtifact({ files });

    await expect(materialize(artifactRoot, artifact.bytes)).resolves.toMatchObject({ reused: false });
    await expect(lstat(staging)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('reuses only an existing destination with matching marker and declared regular files', async () => {
    const artifactRoot = await createRoot();
    const artifact = await buildDeterministicModuleAppArtifact({ files });

    await materialize(artifactRoot, artifact.bytes);
    await expect(materialize(artifactRoot, artifact.bytes)).resolves.toEqual({
      directory: path.join(artifactRoot, artifact.sha256),
      reused: true,
    });

    await chmod(path.join(artifactRoot, artifact.sha256), 0o755);
    await rm(path.join(artifactRoot, artifact.sha256, 'server/index.js'));
    await mkdir(path.join(artifactRoot, artifact.sha256, 'server/index.js'));
    await expect(materialize(artifactRoot, artifact.bytes)).rejects.toMatchObject({
      code: 'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_MISMATCH',
    });
    expect((await lstat(path.join(artifactRoot, artifact.sha256, 'server/index.js'))).isDirectory()).toBe(true);
  });

  it('fails closed on an existing marker mismatch without deleting the destination', async () => {
    const artifactRoot = await createRoot();
    const artifact = await buildDeterministicModuleAppArtifact({ files });
    const destination = path.join(artifactRoot, artifact.sha256);
    await mkdir(destination, { recursive: true });
    await writeFile(
      path.join(destination, '.module-app-artifact.json'),
      JSON.stringify({ artifactSha256: '0'.repeat(64), buildId: BUILD_ID, manifestSha256: '0'.repeat(64), schemaVersion: 1 }),
    );

    await expect(materialize(artifactRoot, artifact.bytes)).rejects.toMatchObject({
      code: 'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_MISMATCH',
    });
    expect(await lstat(destination)).toBeDefined();
  });

  it.each(['../escape.txt', '/absolute.txt', 'C:\\absolute.txt', 'dist\\index.html'])(
    'rejects unsafe archive path %s without creating a final directory',
    async (entryPath) => {
      const artifactRoot = await createRoot();
      const bytes = await createTgz([{ bytes: encoder.encode('unsafe'), name: entryPath, type: 'file' }]);

      await expect(materialize(artifactRoot, bytes)).rejects.toMatchObject({
        code: 'module_app_package_unsafe_path',
      });
      await expect(lstat(path.join(artifactRoot, sha256(bytes)))).rejects.toMatchObject({ code: 'ENOENT' });
    },
  );

  it.each(['symlink', 'link', 'character-device', 'block-device', 'fifo', 'socket'])(
    'rejects unsupported %s entries without creating a final directory',
    async (type) => {
      const artifactRoot = await createRoot();
      const bytes = await createTgz([
        { linkname: 'target', name: 'unsafe-entry', type: type as Headers['type'] },
      ]);

      await expect(materialize(artifactRoot, bytes)).rejects.toMatchObject({
        code: 'module_app_package_archive_invalid',
      });
      await expect(lstat(path.join(artifactRoot, sha256(bytes)))).rejects.toMatchObject({ code: 'ENOENT' });
    },
  );

  it('removes staging and leaves no final directory when declared outputs are missing', async () => {
    const artifactRoot = await createRoot();
    const artifact = await buildDeterministicModuleAppArtifact({
      files: { 'dist/index.html': files['dist/index.html'] },
    });

    await expect(materialize(artifactRoot, artifact.bytes)).rejects.toMatchObject({
      code: 'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_INVALID',
    });
    await expect(lstat(path.join(artifactRoot, artifact.sha256))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      lstat(path.join(artifactRoot, '.staging', `${BUILD_ID}-${CLAIM_TOKEN}`)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
