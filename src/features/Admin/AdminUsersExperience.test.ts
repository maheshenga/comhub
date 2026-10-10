import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.resolve(__dirname, '../../routes/(main)/admin/users/index.tsx');
// B2 拆分：列定义与危险操作弹窗迁入 Users/ 域目录，契约面同步成对迁移
// （confirmLoading 与弹窗 maxWidth 字面量随 BanUserModal/AdjustCreditsModal 落在
// userDangerousParts；列内按钮字面量落在 userColumns）。
const usersBlocks = [
  path.resolve(__dirname, 'Users/userColumns.tsx'),
  path.resolve(__dirname, 'Users/userDangerousParts.tsx'),
];

describe('AdminUsersPage experience contract', () => {
  it('surfaces list recovery and protects export and modal actions', () => {
    const page = fs.readFileSync(pagePath, 'utf8');
    const blocks = usersBlocks.map((block) => fs.readFileSync(block, 'utf8')).join('\n');

    expect(page).toContain('AdminPageError');
    expect(page).toContain('onRetry={refresh}');
    expect(page).toContain('disabled={exporting}');
    expect(blocks).toContain('confirmLoading={actionLoading === banTarget}');
    expect(blocks).toContain("maxWidth: 'calc(100vw - 32px)'");
  });
});
