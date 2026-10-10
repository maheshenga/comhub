'use client';

import { escapeCsv } from './shared';

/**
 * 兑换码结果导出（B2 拆分；header/转义/文件名与原页一致）。
 */
export const exportRedemptionBatchCsv = (result: { batchId: string; codes: string[] }) => {
  const blob = new Blob([`code\n${result.codes.map((c) => escapeCsv(c)).join('\n')}\n`], {
    type: 'text/csv;charset=utf-8',
  });
  const a = document.createElement('a');
  a.download = `redemption-${result.batchId}.csv`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
};
