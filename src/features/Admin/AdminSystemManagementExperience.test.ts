import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');
const readRepoFile = (filePath: string) => readFileSync(path.resolve(repoRoot, filePath), 'utf8');

const managedPages = [
  'src/features/Admin/AdminDefaultSettingsPage.tsx',
  'src/features/Admin/AdminSettingsPage.tsx',
  'src/features/Admin/AdminSystemMaintenancePage.tsx',
];

// M3 split: the default-settings sync actions moved into the
// DefaultSettings/SyncActionButtons block; the maintenance result modal into
// SystemMaintenance/RunResultModal (base-ui Modal + antd Descriptions, as on
// the pre-split page).
const readPageWithSplitBlocks = (filePath: string) => {
  const splitBlocks: Record<string, string[]> = {
    'src/features/Admin/AdminDefaultSettingsPage.tsx': [
      'src/features/Admin/DefaultSettings/SyncActionButtons.tsx',
    ],
    'src/features/Admin/AdminSystemMaintenancePage.tsx': [
      'src/features/Admin/SystemMaintenance/RunResultModal.tsx',
    ],
  };
  let source = readRepoFile(filePath);
  for (const block of splitBlocks[filePath] ?? []) source += readRepoFile(block);
  return source;
};

describe('admin system management experience', () => {
  it('uses the shared hierarchy, recoverable loading state, and stable actions', () => {
    for (const filePath of managedPages) {
      const page = readPageWithSplitBlocks(filePath);

      expect(page, filePath).toContain('AdminPageShell');
      expect(page, filePath).toContain('AdminPageError');
      expect(page, filePath).toContain('AdminFormActions');
      expect(page, filePath).toContain('if (!data) return;');
      expect(page, filePath).toContain('disabled={isLoading || !data');
      expect(page, filePath).not.toContain('padding={24}');
      expect(page, filePath).not.toContain('style={{ maxWidth');
    }
  });

  it('separates maintenance configuration from immediate runtime actions', () => {
    const page = readRepoFile('src/features/Admin/AdminSystemMaintenancePage.tsx');

    expect(page).toContain('AdminSection');
    expect(page).toContain('AdminFormGrid');
    expect(page).toContain('admin.maintenance.runtimeActions');
    expect(page).toContain('AdminDangerousActionButton');
    // M3 split: the page kept Button/Select from base-ui; the result modal's
    // base-ui Modal import moved with the RunResultModal block.
    expect(page).toContain("import { Button, Select } from '@lobehub/ui/base-ui'");
    expect(readRepoFile('src/features/Admin/SystemMaintenance/RunResultModal.tsx')).toContain(
      "import { Modal } from '@lobehub/ui/base-ui'",
    );
  });

  it('uses the shared compact shell for merged configuration entry points', () => {
    const page = readRepoFile('src/features/Admin/AdminMergedRoutePage.tsx');

    expect(page).toContain('AdminPageShell');
    expect(page).toContain('AdminSection');
    expect(page).toContain("import { Button } from '@lobehub/ui/base-ui'");
    expect(page).not.toContain('padding={24}');
    expect(page).not.toContain('style={{ maxWidth');
  });
});
