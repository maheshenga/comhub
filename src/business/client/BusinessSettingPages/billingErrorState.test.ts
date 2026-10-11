import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const readPage = (pageName: string) =>
  readFile(path.join(process.cwd(), `src/business/client/BusinessSettingPages/${pageName}.tsx`), 'utf8');

/**
 * 账务域的桌面表格过去只消费 data（失败时为空数组），于是「加载失败」和
 * 「真的没有记录」渲染出同一张空表，用户既分辨不出也没有重试入口；移动端
 * 分支早已有 role="alert" + retry。这些断言把桌面端的错误分支锁死。
 *
 * Credits.tsx 的导入面太宽（8 个兄弟组件 + useSWRInfinite），组件级渲染测试
 * 的 mock 成本高于收益，故这里用源码契约断言分支存在；组件行为由
 * CreditPackageList.test.tsx 与 tableErrorState.test.tsx 覆盖。
 */
describe('billing table error states', () => {
  it('gates the credit ledger table on the ledger error', async () => {
    const source = await readPage('Credits');

    expect(source).toContain('BusinessTableError');
    // 必须真按 error 分支切换，而不是只在别处 import 一下。
    expect(source).toMatch(/\)\s*:\s*ledgerError\s*\?\s*\(/);
    expect(source).toContain('refreshLedger');
  });

  it('gates the referral history table on its error', async () => {
    const source = await readPage('Referral');

    expect(source).toMatch(/\)\s*:\s*referralHistoryError\s*\?\s*\(/);
    expect(source).toContain('refreshReferralHistory');
  });

  it('gates the credit package table on its error and hides the tab counts', async () => {
    const source = await readPage('CreditPackageList');

    expect(source).toMatch(/\)\s*:\s*error\s*\?\s*\(/);
    // 失败时标签不能显示「（0）」——那会把一次故障伪装成零统计。
    expect(source).toContain("error || isLoading ? '—' : counts[key]");
  });
});
