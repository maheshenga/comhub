import { lstat, mkdir, open, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  MODULE_APP_PACKAGE_MAX_ARCHIVE_BYTES,
  type ModuleAppPackageManifest,
  moduleAppPackageManifestV1Schema,
  moduleAppPackageManifestV2Schema,
} from '@lobechat/types';
import fg from 'fast-glob';
import { zipSync } from 'fflate';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const MAX_FILE_COUNT = 1000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 100 * 1024 * 1024;
const ignored = ['**/.git/**', '**/node_modules/**', '**/.DS_Store', '**/Thumbs.db'];

export class ModuleAppProjectError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = 'ModuleAppProjectError';
  }
}

const pathExists = async (target: string) => {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
};

export const validateModuleAppProject = async (
  directory: string,
): Promise<{ manifest: ModuleAppPackageManifest; manifestPath: string }> => {
  const root = path.resolve(directory);
  const yamlPath = path.join(root, 'module-app.yaml');
  const jsonPath = path.join(root, 'manifest.json');
  const [hasYaml, hasJson] = await Promise.all([pathExists(yamlPath), pathExists(jsonPath)]);
  if (hasYaml === hasJson) {
    throw new ModuleAppProjectError(
      hasYaml ? 'MODULE_APP_MANIFEST_CONFLICT' : 'MODULE_APP_MANIFEST_MISSING',
    );
  }

  const manifestPath = hasYaml ? yamlPath : jsonPath;
  let source: unknown;
  try {
    const text = await readFile(manifestPath, 'utf8');
    source = hasYaml ? parseYaml(text) : JSON.parse(text);
  } catch (error) {
    throw new ModuleAppProjectError('MODULE_APP_MANIFEST_PARSE_FAILED', String(error));
  }

  const parsed = hasYaml
    ? moduleAppPackageManifestV2Schema.safeParse(source)
    : moduleAppPackageManifestV1Schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 20)
      .map((issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`)
      .join('\n');
    throw new ModuleAppProjectError('MODULE_APP_MANIFEST_INVALID', issues);
  }

  return { manifest: parsed.data, manifestPath };
};

export const packModuleAppProject = async (input: { directory: string; output?: string }) => {
  const root = path.resolve(input.directory);
  const { manifest } = await validateModuleAppProject(root);
  const output = path.resolve(
    input.output ?? path.join(root, `${manifest.app.slug}-${manifest.packageVersion}.zip`),
  );
  const outputRelative = path.relative(root, output).replaceAll('\\', '/');
  const candidates = await fg('**/*', {
    absolute: false,
    cwd: root,
    dot: true,
    followSymbolicLinks: false,
    ignore:
      outputRelative && !outputRelative.startsWith('../') ? [...ignored, outputRelative] : ignored,
    onlyFiles: false,
  });
  const files: string[] = [];
  for (const candidate of candidates.sort()) {
    const normalized = candidate.replaceAll('\\', '/');
    const candidateStat = await lstat(path.join(root, candidate));
    if (
      candidateStat.isSymbolicLink() ||
      (!candidateStat.isDirectory() && !candidateStat.isFile())
    ) {
      throw new ModuleAppProjectError('MODULE_APP_PACKAGE_FILE_TYPE_UNSUPPORTED', normalized);
    }
    if (candidateStat.isFile()) files.push(candidate);
  }
  if (files.length === 0 || files.length > MAX_FILE_COUNT) {
    throw new ModuleAppProjectError('MODULE_APP_PACKAGE_FILE_COUNT_INVALID');
  }

  const entries: Record<string, Uint8Array> = {};
  let totalFileBytes = 0;
  for (const file of files) {
    const normalized = file.replaceAll('\\', '/');
    const filePath = path.join(root, file);
    const fileStat = await lstat(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      throw new ModuleAppProjectError('MODULE_APP_PACKAGE_FILE_TYPE_UNSUPPORTED', normalized);
    }
    if (fileStat.size > MAX_FILE_BYTES) {
      throw new ModuleAppProjectError('MODULE_APP_PACKAGE_FILE_TOO_LARGE', normalized);
    }
    totalFileBytes += fileStat.size;
    if (totalFileBytes > MAX_TOTAL_FILE_BYTES) {
      throw new ModuleAppProjectError('MODULE_APP_PACKAGE_EXPANDED_TOO_LARGE');
    }
    const handle = await open(filePath, 'r');
    let bytes: Uint8Array;
    try {
      const openedStat = await handle.stat();
      if (
        !openedStat.isFile() ||
        openedStat.dev !== fileStat.dev ||
        openedStat.ino !== fileStat.ino ||
        openedStat.size !== fileStat.size
      ) {
        throw new ModuleAppProjectError('MODULE_APP_PACKAGE_FILE_CHANGED', normalized);
      }
      bytes = await handle.readFile();
      const completedStat = await handle.stat();
      if (
        bytes.byteLength !== openedStat.size ||
        completedStat.size !== openedStat.size ||
        completedStat.mtimeMs !== openedStat.mtimeMs ||
        completedStat.ctimeMs !== openedStat.ctimeMs
      ) {
        throw new ModuleAppProjectError('MODULE_APP_PACKAGE_FILE_CHANGED', normalized);
      }
    } finally {
      await handle.close();
    }
    entries[normalized] = bytes;
  }

  const archive = zipSync(entries, { level: 6 });
  if (archive.byteLength > MODULE_APP_PACKAGE_MAX_ARCHIVE_BYTES) {
    throw new ModuleAppProjectError('MODULE_APP_PACKAGE_ARCHIVE_TOO_LARGE');
  }
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, archive);

  return { fileCount: files.length, output, sizeBytes: archive.byteLength };
};

const scaffoldManifest = (slug: string, displayName: string) => ({
  app: {
    actions: [],
    appType: 'standard_app',
    billing: { chargeMode: 'free' },
    category: 'productivity',
    description: `${displayName} module application.`,
    displayName,
    icon: 'Box',
    pages: [],
    slug,
    source: 'developer',
    status: 'draft',
    tags: [],
  },
  build: { frontend: { output: 'dist', profile: 'node22-static' } },
  entitlements: [],
  manifestVersion: 2,
  packageVersion: '0.1.0',
  runtime: { functions: [], permissions: [] },
});

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export const initializeModuleAppProject = async (input: {
  directory: string;
  displayName?: string;
  slug?: string;
}) => {
  const root = path.resolve(input.directory);
  const slug =
    input.slug ??
    path
      .basename(root)
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new ModuleAppProjectError('MODULE_APP_SLUG_INVALID');
  }
  const displayName = input.displayName?.trim() || slug;
  await mkdir(root, { recursive: true });
  if ((await readdir(root)).length > 0) {
    throw new ModuleAppProjectError('MODULE_APP_PROJECT_DIRECTORY_NOT_EMPTY');
  }
  await mkdir(path.join(root, 'dist'), { recursive: true });
  await Promise.all([
    writeFile(
      path.join(root, 'module-app.yaml'),
      stringifyYaml(scaffoldManifest(slug, displayName)),
      'utf8',
    ),
    writeFile(
      path.join(root, 'dist', 'index.html'),
      `<!doctype html>\n<html lang="en"><meta charset="utf-8"><title>${escapeHtml(displayName)}</title><main id="app">${escapeHtml(displayName)}</main></html>\n`,
      'utf8',
    ),
  ]);

  await validateModuleAppProject(root);
  return { directory: root, slug };
};
