import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');
const readRepoFile = (filePath: string) => readFileSync(path.resolve(repoRoot, filePath), 'utf8');

// M3 split: the instance table columns (dangerous-action buttons, delete
// impact guards, sync copy) moved into the Providers/useInstanceColumns
// block; the models drawer into Providers/ModelsDrawer.
const providersPageBlocks = [
  'src/features/Admin/AdminProvidersPage.tsx',
  'src/features/Admin/Providers/useInstanceColumns.tsx',
  'src/features/Admin/Providers/ModelsDrawer.tsx',
].map(readRepoFile);

const providersPageSource = providersPageBlocks.join('\n');

describe('admin provider management experience', () => {
  it('uses the shared full-width hierarchy and recoverable instance table', () => {
    const page = readRepoFile('src/features/Admin/AdminProvidersPage.tsx');

    expect(page).toContain('AdminPageShell');
    expect(page).toContain('AdminPageError');
    expect(page).toContain('AdminSection');
    expect(page).toContain('AdminResponsiveTable');
    expect(page).toContain('mutate: refresh');
    expect(page).toContain('disabled={isLoading || !data');
    expect(page).not.toContain('padding={24}');
  });

  it('keeps model synchronization and guarded provider deletion available', () => {
    expect(providersPageSource).toContain('syncAiProviderInstanceModels');
    expect(providersPageSource).toContain('refreshAiProviderRuntimeCache');
    expect(providersPageSource).toContain('AdminDangerousActionButton');
    expect(providersPageSource).toContain('getAiProviderInstanceDeleteImpact');
    expect(providersPageSource).toContain('ModelsDrawer');
  });

  it('makes authoritative model replacement explicit and reports synchronized metadata', () => {
    expect(providersPageSource).toContain('同步将删除该实例的全部现有模型');
    expect(providersPageSource).toContain('result.deletedCount');
    expect(providersPageSource).toContain('result.pricingCount');
    expect(providersPageSource).toContain('result.abilitiesCount');
  });
});
