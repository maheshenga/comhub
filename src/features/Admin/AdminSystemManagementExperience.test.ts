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
    // B4/B5 收敛：base-ui 导入并集含 Alert/toast（message→toast、Alert→base-ui）。
    // 第八轮：antd Descriptions 迁 base-ui（同 import 合并 Modal+Descriptions）。
    // UI6 merges the former `@lobehub/ui/base-ui` barrel into the root, and the
    // grouped import is shared with the page's other root primitives (Flexbox).
    expect(page).toMatch(
      /import \{[^}]+\bAlert\b[^}]+\bButton\b[^}]+\bSelect\b[^}]+\btoast\b[^}]+\} from '@lobehub\/ui'/,
    );
    expect(readRepoFile('src/features/Admin/SystemMaintenance/RunResultModal.tsx')).toMatch(
      /import \{[^}]+\bDescriptions\b[^}]+\bModal\b[^}]+\} from '@lobehub\/ui'/,
    );
  });

  it('uses the shared compact shell for merged configuration entry points', () => {
    const page = readRepoFile('src/features/Admin/AdminMergedRoutePage.tsx');

    expect(page).toContain('AdminPageShell');
    expect(page).toContain('AdminSection');
    // B4/B5 收敛：Alert 随全域 no-restricted-imports 收敛并入 base-ui 导入。
    // UI6 后 base-ui 与根桶合并，Flexbox 等根桶原语共享同一 import。
    expect(page).toMatch(/import \{[^}]+\bAlert\b[^}]+\bButton\b[^}]+\} from '@lobehub\/ui'/);
    expect(page).not.toContain('padding={24}');
    expect(page).not.toContain('style={{ maxWidth');
  });
});
