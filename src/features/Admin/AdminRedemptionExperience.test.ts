import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.resolve(__dirname, '../../routes/(main)/admin/redemption/index.tsx');
// B2 拆分：生成弹窗表单迁入 Redemption/ 域目录，契约面同步成对迁移
// （受控表单 useFrom/validateFields 语义落在 generateForm 的调用方 index.tsx，
// 字段定义与列渲染字面量分别落在 generateForm / redemptionColumns）。
const redemptionBlocks = [
  path.resolve(__dirname, 'Redemption/generateForm.tsx'),
  path.resolve(__dirname, 'Redemption/redemptionColumns.tsx'),
];

describe('AdminRedemptionPage experience contract', () => {
  it('uses shared states while preserving responsive filters and bulk actions', () => {
    const page = fs.readFileSync(pagePath, 'utf8');
    const blocks = redemptionBlocks.map((block) => fs.readFileSync(block, 'utf8')).join('\n');

    expect(page).toContain('AdminPageShell');
    expect(page).toContain('AdminResponsiveTable');
    // 外壳状态槽通道：onRetry 经 AdminPageShell state 槽透传（原内联 AdminPageError 被替换）
    expect(page).toContain('onRetry: mutate');
    expect(page).toContain("width: 'min(200px, 100%)'");
    expect(page).toContain('AdminBulkActionFlow');
    // 生成弹窗表单与列定义的契约字面量随拆分迁移
    expect(blocks).toContain("addonAfter={'M'}");
    expect(blocks).toContain('REWARD_COLORS');
  });
});
