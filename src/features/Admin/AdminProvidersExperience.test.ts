import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');
const readRepoFile = (filePath: string) => readFileSync(path.resolve(repoRoot, filePath), 'utf8');

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
    const page = readRepoFile('src/features/Admin/AdminProvidersPage.tsx');

    expect(page).toContain('syncAiProviderInstanceModels');
    expect(page).toContain('refreshAiProviderRuntimeCache');
    expect(page).toContain('AdminDangerousActionButton');
    expect(page).toContain('getAiProviderInstanceDeleteImpact');
    expect(page).toContain('ModelsDrawer');
  });
});
