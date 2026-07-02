const REPO_PATH_PREFIXES = [
  '.github/',
  'apps/',
  'docs/',
  'e2e/',
  'locales/',
  'packages/',
  'public/',
  'scripts/',
  'src/',
  'tests/',
];

const REPO_ROOT_FILES = new Set([
  'Dockerfile',
  'next.config.ts',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.mts',
]);

const UNMERGED_STATUS_CODES = new Set(['AA', 'AU', 'DD', 'DU', 'UA', 'UD', 'UU']);

/**
 * @typedef {{ name: string; sha?: string }} UpstreamTag
 * @typedef {{ filename?: string; previous_filename?: string; status?: string }} GitHubCommitFile
 * @typedef {{ files?: GitHubCommitFile[] }} GitHubCommitWithFiles
 * @typedef {{ from: string; to: string }} RenamedFile
 * @typedef {{ addedFiles: string[]; allFiles: string[]; modifiedFiles: string[]; renamedFiles: RenamedFile[] }} CommitChangedFiles
 * @typedef {{ from: string; to: string }} RenamedMissingFile
 * @typedef {{ migrationMetadataFiles: string[]; missingAddedFiles: string[]; renamedMissingFiles: RenamedMissingFile[]; staleModifiedFiles: string[] }} UpstreamFeatureAudit
 * @typedef {{ command: string; exitCode?: number; status: 'failed' | 'passed' | 'skipped' }} VerificationResult
 */

/**
 * @param {string} output
 * @returns {UpstreamTag[]}
 */
export const parseLsRemoteTags = (output) => {
  const tags = new Map();

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^([0-9a-f]{40})\s+refs\/tags\/(.+)$/i);
    if (!match) continue;

    const [, sha, rawName] = match;
    if (rawName.endsWith('^{}')) continue;

    tags.set(rawName, { name: rawName, sha });
  }

  return [...tags.values()].sort((a, b) => compareTagNames(a.name, b.name));
};

/**
 * @param {(string | UpstreamTag)[]} tags
 * @param {'canary' | 'stable'} [channel]
 * @returns {string}
 */
export const selectLatestUpstreamTag = (tags, channel = 'stable') => {
  const candidates = tags
    .map((tag) => (typeof tag === 'string' ? { name: tag } : tag))
    .filter((tag) => {
      const parsed = parseTagVersion(tag.name);
      if (!parsed) return false;

      return channel === 'canary' ? parsed.canary !== undefined : parsed.canary === undefined;
    })
    .sort((a, b) => compareTagNames(a.name, b.name));

  const latest = candidates.at(-1);
  if (!latest) throw new Error(`No ${channel} upstream tag found`);

  return latest.name;
};

/**
 * @param {{ baseBranch?: string; upstreamRef: string }} options
 * @returns {string}
 */
export const buildCandidateBranch = ({ upstreamRef }) => {
  const normalized = upstreamRef
    .replace(/^refs\/tags\//, '')
    .replace(/^refs\/heads\//, '')
    .replace(/^origin\//, '')
    .replace(/^upstream\//, '');

  const safeRef = normalized
    .replaceAll(/[^\w.-]/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '');

  return `upgrade/upstream-${safeRef}-comhub-sync`;
};

/**
 * @param {string} statusOutput
 * @returns {string[]}
 */
export const parseConflictFiles = (statusOutput) => {
  const files = [];

  for (const line of statusOutput.split(/\r?\n/)) {
    if (line.length < 4) continue;

    const status = line.slice(0, 2);
    if (!UNMERGED_STATUS_CODES.has(status)) continue;

    files.push(normalizeRepoPath(parsePorcelainPath(line.slice(3))));
  }

  return uniqueSorted(files);
};

/**
 * @param {string} markdown
 * @returns {string[]}
 */
export const extractCustomizationFilePaths = (markdown) => {
  const paths = [];
  const pattern = /`([^`]+)`/g;
  let match;

  while ((match = pattern.exec(markdown))) {
    const path = normalizeRepoPath(match[1].trim());
    if (!isLikelyRepoPath(path)) continue;

    paths.push(path);
  }

  return uniqueSorted(paths);
};

/**
 * @param {{ changedFiles: string[]; customizationFiles: string[] }} options
 * @returns {string[]}
 */
export const findTouchedCustomizations = ({ changedFiles, customizationFiles }) => {
  const normalizedCustomizations = customizationFiles.map(normalizeRepoPath);
  const touched = [];

  for (const changedFile of changedFiles.map(normalizeRepoPath)) {
    const touchesCustomization = normalizedCustomizations.some(
      (customizationPath) =>
        changedFile === customizationPath || changedFile.startsWith(`${customizationPath}/`),
    );

    if (touchesCustomization) touched.push(changedFile);
  }

  return uniqueSorted(touched);
};

/**
 * @param {GitHubCommitWithFiles[]} commits
 * @returns {CommitChangedFiles}
 */
export const collectChangedFilesFromCommits = (commits = []) => {
  const addedFiles = [];
  const allFiles = [];
  const modifiedFiles = [];
  const renamedFiles = [];

  for (const commit of commits) {
    const files = Array.isArray(commit?.files) ? commit.files : [];

    for (const file of files) {
      const filename = normalizeOptionalRepoPath(file?.filename);
      if (!filename) continue;

      const status = (file?.status || '').toLowerCase();
      allFiles.push(filename);

      if (status === 'added') {
        addedFiles.push(filename);
        continue;
      }

      if (status === 'modified' || status === 'changed') {
        modifiedFiles.push(filename);
        continue;
      }

      if (status === 'renamed') {
        const previousFilename = normalizeOptionalRepoPath(file?.previous_filename);
        if (!previousFilename) continue;

        allFiles.push(previousFilename);
        renamedFiles.push({ from: previousFilename, to: filename });
      }
    }
  }

  return {
    addedFiles: uniqueSorted(addedFiles),
    allFiles: uniqueSorted(allFiles),
    modifiedFiles: uniqueSorted(modifiedFiles),
    renamedFiles: uniqueSortedRenames(renamedFiles),
  };
};

/**
 * @param {{
 *   baseBranch: string;
 *   candidateBranch: string;
 *   changedFiles?: string[];
 *   conflictFiles?: string[];
 *   currentVersion?: string;
 *   generatedAt: string;
 *   mergeStatus: 'clean' | 'conflict' | 'failed' | 'noop';
 *   touchedCustomizations?: string[];
 *   upstreamRef: string;
 *   verification?: VerificationResult[];
 * }} options
 * @returns {string}
 */
export const renderMarkdownReport = ({
  baseBranch,
  candidateBranch,
  changedFiles = [],
  conflictFiles = [],
  currentVersion,
  generatedAt,
  mergeStatus,
  touchedCustomizations = [],
  upstreamRef,
  verification = [],
}) => {
  const result = getResultLabel(mergeStatus, verification);
  const lines = [
    `# ComHub Upstream Sync Report`,
    '',
    `- Result: ${result}`,
    `- Generated at: ${generatedAt}`,
    `- Current package version: ${currentVersion || 'unknown'}`,
    `- Base branch: \`${baseBranch}\``,
    `- Upstream ref: \`${upstreamRef}\``,
    `- Candidate branch: \`${candidateBranch}\``,
    `- Changed files from upstream: ${changedFiles.length}`,
    `- Conflicts: ${conflictFiles.length}`,
    `- Customized files touched: ${touchedCustomizations.length}`,
    '',
    `## Merge Conflicts`,
    '',
    ...renderList(conflictFiles, 'No merge conflicts detected.'),
    '',
    `## ComHub Customization Touches`,
    '',
    ...renderList(touchedCustomizations, 'No registered ComHub customization files were touched.'),
    '',
    `## Verification`,
    '',
    ...renderVerification(verification),
    '',
    `## Upstream Changed Files`,
    '',
    ...renderList(changedFiles.slice(0, 200), 'No upstream changed files were detected.'),
  ];

  if (changedFiles.length > 200) {
    lines.push('', `_Only the first 200 changed files are shown._`);
  }

  lines.push('');

  return lines.join('\n');
};

/**
 * @param {{
 *   currentTreeOutput: string;
 *   targetToHeadNameStatusOutput?: string;
 *   upstreamAddedFiles?: string[];
 *   upstreamModifiedRawDiffOutput?: string;
 * }} options
 * @returns {UpstreamFeatureAudit}
 */
export const buildUpstreamFeatureAudit = ({
  currentTreeOutput,
  targetToHeadNameStatusOutput = '',
  upstreamAddedFiles = [],
  upstreamModifiedRawDiffOutput = '',
}) => {
  const currentTree = parseLsTreeBlobs(currentTreeOutput);
  const currentFiles = new Set(currentTree.keys());
  const renameMap = parseNameStatusRenames(targetToHeadNameStatusOutput);
  const migrationMetadataFiles = [];
  const renamedMissingFiles = [];
  const missingAddedFiles = [];

  for (const rawFile of upstreamAddedFiles.map(normalizeRepoPath)) {
    if (!rawFile || currentFiles.has(rawFile)) continue;

    const renamedTo = renameMap.get(rawFile);
    if (renamedTo && currentFiles.has(renamedTo)) {
      renamedMissingFiles.push({ from: rawFile, to: renamedTo });
      continue;
    }

    if (isMigrationMetadataFile(rawFile)) {
      migrationMetadataFiles.push(rawFile);
      continue;
    }

    missingAddedFiles.push(rawFile);
  }

  const staleModifiedFiles = parseRawModifiedDiff(upstreamModifiedRawDiffOutput)
    .filter(({ oldBlob, path: filePath }) => currentTree.get(filePath) === oldBlob)
    .map(({ path: filePath }) => filePath);

  return {
    migrationMetadataFiles: uniqueSorted(migrationMetadataFiles),
    missingAddedFiles: uniqueSorted(missingAddedFiles),
    renamedMissingFiles: renamedMissingFiles.sort((a, b) => a.from.localeCompare(b.from)),
    staleModifiedFiles: uniqueSorted(staleModifiedFiles),
  };
};

/**
 * @param {{
 *   audit: UpstreamFeatureAudit;
 *   baseRef: string;
 *   changedFileCount?: number;
 *   changedFileSource?: string;
 *   currentRef?: string;
 *   generatedAt: string;
 *   upstreamRef: string;
 * }} options
 * @returns {string}
 */
export const renderUpstreamFeatureAuditReport = ({
  audit,
  baseRef,
  changedFileCount,
  changedFileSource = 'local git diff',
  currentRef = 'HEAD',
  generatedAt,
  upstreamRef,
}) => {
  const migrationMetadataFiles = audit.migrationMetadataFiles || [];
  const lines = [
    '# ComHub Upstream Feature Audit',
    '',
    `- Generated at: ${generatedAt}`,
    `- Base upstream ref: \`${baseRef}\``,
    `- Target upstream ref: \`${upstreamRef}\``,
    `- Current ref: \`${currentRef}\``,
    `- Changed-file source: ${changedFileSource}`,
    ...(Number.isFinite(changedFileCount) ? [`- Changed files considered: ${changedFileCount}`] : []),
    `- Missing upstream-added files: ${audit.missingAddedFiles.length}`,
    `- Upstream-modified files still matching base: ${audit.staleModifiedFiles.length}`,
    `- Renamed or re-homed upstream files: ${audit.renamedMissingFiles.length}`,
    `- Migration metadata files: ${migrationMetadataFiles.length}`,
    '',
    '## Missing Upstream-Added Files',
    '',
    ...renderList(audit.missingAddedFiles, 'No missing upstream-added files detected.'),
    '',
    '## Upstream-Modified Files Still Matching Base',
    '',
    ...renderList(audit.staleModifiedFiles, 'No stale upstream-modified files detected.'),
    '',
    '## Renamed or Re-Homed Upstream Files',
    '',
    ...renderRenameList(audit.renamedMissingFiles),
    '',
    '## Migration Metadata Files',
    '',
    ...renderList(migrationMetadataFiles, 'No missing migration metadata files detected.'),
    '',
  ];

  return lines.join('\n');
};

/**
 * @param {string} value
 * @returns {string}
 */
export const normalizeRepoPath = (value) =>
  value.replaceAll('\\', '/').replace(/^\.\//, '').replaceAll(/\/+$/g, '');

const normalizeOptionalRepoPath = (value) => {
  if (typeof value !== 'string') return '';

  return normalizeRepoPath(value.trim());
};

const isLikelyRepoPath = (value) =>
  REPO_ROOT_FILES.has(value) ||
  REPO_PATH_PREFIXES.some((prefix) => value === prefix.slice(0, -1) || value.startsWith(prefix));

const parsePorcelainPath = (value) => {
  const trimmed = value.trim();
  const renameArrowIndex = trimmed.indexOf(' -> ');
  const path = renameArrowIndex >= 0 ? trimmed.slice(renameArrowIndex + 4) : trimmed;

  if (path.startsWith('"') && path.endsWith('"')) {
    try {
      return JSON.parse(path);
    } catch {
      return path.slice(1, -1);
    }
  }

  return path;
};

const parseLsTreeBlobs = (output) => {
  const blobs = new Map();

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;

    const tabIndex = line.indexOf('\t');
    if (tabIndex < 0) continue;

    const metadata = line.slice(0, tabIndex).trim().split(/\s+/);
    if (metadata.length < 3) continue;

    blobs.set(normalizeRepoPath(line.slice(tabIndex + 1)), metadata[2]);
  }

  return blobs;
};

const parseNameStatusRenames = (output) => {
  const renames = new Map();

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;

    const parts = line.split('\t');
    if (parts.length >= 3 && parts[0].startsWith('R')) {
      renames.set(normalizeRepoPath(parts[1]), normalizeRepoPath(parts[2]));
      continue;
    }

    const arrowIndex = line.indexOf(' -> ');
    if (parts[0]?.startsWith('R') && arrowIndex >= 0) {
      const source = line.slice(parts[0].length, arrowIndex).trim();
      const target = line.slice(arrowIndex + 4).trim();
      renames.set(normalizeRepoPath(source), normalizeRepoPath(target));
    }
  }

  return renames;
};

const parseRawModifiedDiff = (output) => {
  const files = [];

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;

    const tabIndex = line.indexOf('\t');
    if (tabIndex < 0) continue;

    const metadata = line.slice(0, tabIndex).trim().split(/\s+/);
    if (metadata.length < 5) continue;

    files.push({
      oldBlob: metadata[2],
      path: normalizeRepoPath(
        line
          .slice(tabIndex + 1)
          .split('\t')
          .at(-1),
      ),
    });
  }

  return files;
};

const isMigrationMetadataFile = (filePath) =>
  /^packages\/database\/migrations\/meta\/\d+_snapshot\.json$/.test(filePath);

const uniqueSorted = (values) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

const uniqueSortedRenames = (values) => {
  const renames = new Map();

  for (const value of values) {
    if (!value.from || !value.to) continue;

    renames.set(`${value.from}\0${value.to}`, value);
  }

  return [...renames.values()].sort(
    (a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
  );
};

const parseTagVersion = (tagName) => {
  const match = tagName.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-canary\.(\d+))?$/);
  if (!match) return;

  const [, major, minor, patch, canary] = match;
  return {
    canary: canary === undefined ? undefined : Number(canary),
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
  };
};

const compareTagNames = (left, right) => {
  const a = parseTagVersion(left);
  const b = parseTagVersion(right);

  if (!a && !b) return left.localeCompare(right);
  if (!a) return -1;
  if (!b) return 1;

  for (const key of ['major', 'minor', 'patch']) {
    const diff = a[key] - b[key];
    if (diff !== 0) return diff;
  }

  return (a.canary ?? -1) - (b.canary ?? -1);
};

const getResultLabel = (mergeStatus, verification) => {
  if (mergeStatus === 'noop') return 'no upstream changes';
  if (mergeStatus === 'conflict') return 'merge conflicts';
  if (mergeStatus === 'failed') return 'merge failed';

  const failedVerification = verification.find((item) => item.status === 'failed');
  if (failedVerification) return 'verification failed';

  return 'clean candidate';
};

const renderList = (items, emptyText) => {
  if (items.length === 0) return [emptyText];

  return items.map((item) => `- \`${item}\``);
};

const renderVerification = (verification) => {
  if (verification.length === 0) return ['Verification was not run.'];

  return verification.map((item) => {
    const detail = item.exitCode === undefined ? '' : ` (exit ${item.exitCode})`;

    return `- ${item.status}: \`${item.command}\`${detail}`;
  });
};

const renderRenameList = (items) => {
  if (items.length === 0) return ['No renamed or re-homed upstream files detected.'];

  return items.map((item) => `- \`${item.from}\` -> \`${item.to}\``);
};
