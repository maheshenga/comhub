import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.resolve(__dirname, '../../routes/(main)/admin/plans/index.tsx');
// B2 拆分：套餐列定义（含模型权限摘要与操作按钮）迁入 Plans/ 域目录，
// 契约面同步成对迁移。
const plansBlocks = [path.resolve(__dirname, 'Plans/shared.tsx')];

describe('AdminPlansPage experience contract', () => {
  it('uses the shared shell, retry state, and responsive data region', () => {
    const page = fs.readFileSync(pagePath, 'utf8');
    const blocks = plansBlocks.map((block) => fs.readFileSync(block, 'utf8')).join('\n');

    expect(page).toContain('AdminPageShell');
    expect(page).toContain('AdminPageError');
    expect(page).toContain('AdminResponsiveTable');
    expect(page).toContain('disabled={isLoading || Boolean(error)}');
    expect(page).toContain('onRetry={refresh}');
    // wrap="wrap" 契约字面量随列定义迁 Plans/shared.tsx
    expect(blocks).toContain('wrap="wrap"');
  });
});
