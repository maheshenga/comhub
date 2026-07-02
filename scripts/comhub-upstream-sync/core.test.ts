import { describe, expect, it } from 'vitest';

import {
  buildCandidateBranch,
  buildUpstreamFeatureAudit,
  collectChangedFilesFromCommits,
  extractCustomizationFilePaths,
  findTouchedCustomizations,
  parseConflictFiles,
  parseLsRemoteTags,
  renderUpstreamFeatureAuditReport,
  renderMarkdownReport,
  selectLatestUpstreamTag,
} from './core.mjs';

describe('comhub upstream sync core', () => {
  it('selects latest stable and canary upstream tags from ls-remote output', () => {
    const tags = parseLsRemoteTags(`
1111111111111111111111111111111111111111\trefs/tags/v2.2.7
2222222222222222222222222222222222222222\trefs/tags/v2.2.9
3333333333333333333333333333333333333333\trefs/tags/v2.2.10-canary.9
4444444444444444444444444444444444444444\trefs/tags/v2.2.10-canary.14
5555555555555555555555555555555555555555\trefs/tags/v2.2.10-canary.14^{}
`);

    expect(selectLatestUpstreamTag(tags, 'stable')).toBe('v2.2.9');
    expect(selectLatestUpstreamTag(tags, 'canary')).toBe('v2.2.10-canary.14');
  });

  it('builds deterministic candidate branches from upstream refs', () => {
    expect(
      buildCandidateBranch({
        baseBranch: 'upgrade/upstream-v2.2.6-comhub-merge',
        upstreamRef: 'refs/tags/v2.2.10-canary.14',
      }),
    ).toBe('upgrade/upstream-v2.2.10-canary.14-comhub-sync');
  });

  it('parses unmerged files from porcelain status output', () => {
    const conflictFiles = parseConflictFiles(`
UU packages/model-runtime/src/index.ts
 M src/features/Brand/BrandProvider.tsx
AA "src/routes/(main)/settings/provider/index.tsx"
R  old/file.ts -> new/file.ts
`);

    expect(conflictFiles).toEqual([
      'packages/model-runtime/src/index.ts',
      'src/routes/(main)/settings/provider/index.tsx',
    ]);
  });

  it('extracts customized repository paths from the customization registry', () => {
    const paths = extractCustomizationFilePaths(`
| Area | Files | Change |
| --- | --- | --- |
| Admin providers | \`src/server/globalConfig/index.ts\`, \`packages/database/src/repositories/aiInfra/index.ts\` | Preserve DB providers |
| Deploy | \`.github/workflows/comhub-deploy.yml\`, \`docs/development/comhub-github-actions-deploy.zh-CN.md\` | Preserve deploy |
| Root | \`Dockerfile\`, \`package.json\` | Preserve runtime base |
| Note | \`not a repo path\` | ignored |
`);

    expect(paths).toEqual([
      '.github/workflows/comhub-deploy.yml',
      'Dockerfile',
      'docs/development/comhub-github-actions-deploy.zh-CN.md',
      'package.json',
      'packages/database/src/repositories/aiInfra/index.ts',
      'src/server/globalConfig/index.ts',
    ]);
  });

  it('finds upstream changes that touch customized files or descendants', () => {
    const touched = findTouchedCustomizations({
      changedFiles: [
        'src/server/globalConfig/index.ts',
        'src/features/Brand/BrandProvider.tsx',
        'packages/model-runtime/src/provider.ts',
      ],
      customizationFiles: [
        'src/server/globalConfig/index.ts',
        'src/features/Brand',
        'docs/development/comhub-github-actions-deploy.zh-CN.md',
      ],
    });

    expect(touched).toEqual([
      'src/features/Brand/BrandProvider.tsx',
      'src/server/globalConfig/index.ts',
    ]);
  });

  it('renders a report with conflicts, customization touches, and verification status', () => {
    const report = renderMarkdownReport({
      baseBranch: 'upgrade/upstream-v2.2.6-comhub-merge',
      candidateBranch: 'upgrade/upstream-v2.2.9-comhub-sync',
      changedFiles: ['src/server/globalConfig/index.ts'],
      conflictFiles: ['packages/model-runtime/src/index.ts'],
      currentVersion: '2.2.7',
      generatedAt: '2026-07-01T00:00:00.000Z',
      mergeStatus: 'conflict',
      touchedCustomizations: ['src/server/globalConfig/index.ts'],
      upstreamRef: 'v2.2.9',
      verification: [
        { command: 'git diff --check', status: 'skipped' },
        { command: 'tsgo --noEmit', status: 'skipped' },
      ],
    });

    expect(report).toContain('Result: merge conflicts');
    expect(report).toContain('packages/model-runtime/src/index.ts');
    expect(report).toContain('src/server/globalConfig/index.ts');
    expect(report).toContain('git diff --check');
  });

  it('renders no-op reports without implying a deployable candidate', () => {
    const report = renderMarkdownReport({
      baseBranch: 'upgrade/upstream-v2.2.6-comhub-merge',
      candidateBranch: 'upgrade/upstream-v2.2.9-comhub-sync',
      generatedAt: '2026-07-01T00:00:00.000Z',
      mergeStatus: 'noop',
      upstreamRef: 'v2.2.9',
    });

    expect(report).toContain('Result: no upstream changes');
  });

  it('builds a candidate branch for non-version refs without unsafe characters', () => {
    expect(
      buildCandidateBranch({
        baseBranch: 'main',
        upstreamRef: 'feature/provider runtime+pricing',
      }),
    ).toBe('upgrade/upstream-feature-provider-runtime-pricing-comhub-sync');
  });

  it('audits upstream feature gaps without treating migration renames as missing features', () => {
    const audit = buildUpstreamFeatureAudit({
      currentTreeOutput: `
100644 blob bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\tpackages/database/migrations/0129_workspace_device_and_ai_infra_surrogate_pk.sql
100644 blob 1111111111111111111111111111111111111111\tsrc/features/old-provider.ts
100644 blob 3333333333333333333333333333333333333333\tsrc/features/merged-provider.ts
`,
      targetToHeadNameStatusOutput: `
R053\tpackages/database/migrations/0111_workspace_device_and_ai_infra_surrogate_pk.sql\tpackages/database/migrations/0129_workspace_device_and_ai_infra_surrogate_pk.sql
D\t.github/workflows/mcp-submission-handler.yml
`,
      upstreamAddedFiles: [
        '.github/workflows/mcp-submission-handler.yml',
        'packages/database/migrations/0111_workspace_device_and_ai_infra_surrogate_pk.sql',
        'packages/database/migrations/meta/0111_snapshot.json',
      ],
      upstreamModifiedRawDiffOutput: `
:100644 100644 1111111111111111111111111111111111111111 2222222222222222222222222222222222222222 M\tsrc/features/old-provider.ts
:100644 100644 0000000000000000000000000000000000000000 3333333333333333333333333333333333333333 M\tsrc/features/merged-provider.ts
`,
    });

    expect(audit.missingAddedFiles).toEqual(['.github/workflows/mcp-submission-handler.yml']);
    expect(audit.migrationMetadataFiles).toEqual([
      'packages/database/migrations/meta/0111_snapshot.json',
    ]);
    expect(audit.renamedMissingFiles).toEqual([
      {
        from: 'packages/database/migrations/0111_workspace_device_and_ai_infra_surrogate_pk.sql',
        to: 'packages/database/migrations/0129_workspace_device_and_ai_infra_surrogate_pk.sql',
      },
    ]);
    expect(audit.staleModifiedFiles).toEqual(['src/features/old-provider.ts']);
  });

  it('aggregates changed files from GitHub commit file lists without compare API truncation', () => {
    const changedFiles = collectChangedFilesFromCommits([
      {
        files: [
          { filename: 'src/features/provider.ts', status: 'added' },
          { filename: 'src/features/existing.ts', status: 'modified' },
          {
            filename: 'src/features/new-name.ts',
            previous_filename: 'src/features/old-name.ts',
            status: 'renamed',
          },
        ],
      },
      {
        files: [
          { filename: './src/features/provider.ts', status: 'modified' },
          { filename: 'docs/removed.md', status: 'removed' },
          { filename: 'packages/database/migrations/meta/0129_snapshot.json', status: 'added' },
        ],
      },
    ]);

    expect(changedFiles).toEqual({
      addedFiles: [
        'packages/database/migrations/meta/0129_snapshot.json',
        'src/features/provider.ts',
      ],
      allFiles: [
        'docs/removed.md',
        'packages/database/migrations/meta/0129_snapshot.json',
        'src/features/existing.ts',
        'src/features/new-name.ts',
        'src/features/old-name.ts',
        'src/features/provider.ts',
      ],
      modifiedFiles: ['src/features/existing.ts', 'src/features/provider.ts'],
      renamedFiles: [{ from: 'src/features/old-name.ts', to: 'src/features/new-name.ts' }],
    });
  });

  it('renders an upstream feature audit report with actionable and informational sections', () => {
    const report = renderUpstreamFeatureAuditReport({
      audit: {
        migrationMetadataFiles: ['packages/database/migrations/meta/0111_snapshot.json'],
        missingAddedFiles: ['.github/workflows/mcp-submission-handler.yml'],
        renamedMissingFiles: [
          {
            from: 'packages/database/migrations/0111_workspace_device_and_ai_infra_surrogate_pk.sql',
            to: 'packages/database/migrations/0129_workspace_device_and_ai_infra_surrogate_pk.sql',
          },
        ],
        staleModifiedFiles: [],
      },
      baseRef: 'v2.2.6',
      changedFileCount: 437,
      changedFileSource: 'commit-file aggregation',
      currentRef: 'HEAD',
      generatedAt: '2026-07-02T00:00:00.000Z',
      upstreamRef: 'v2.2.9',
    });

    expect(report).toContain('Missing upstream-added files: 1');
    expect(report).toContain('Changed-file source: commit-file aggregation');
    expect(report).toContain('Changed files considered: 437');
    expect(report).toContain('.github/workflows/mcp-submission-handler.yml');
    expect(report).toContain('Migration metadata files: 1');
    expect(report).toContain('packages/database/migrations/meta/0111_snapshot.json');
    expect(report).toContain('Renamed or re-homed upstream files');
    expect(report).toContain('0129_workspace_device_and_ai_infra_surrogate_pk.sql');
  });
});
