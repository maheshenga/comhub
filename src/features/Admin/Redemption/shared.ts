'use client';

/** 兑换码 CSV 转义（B2 拆分，与 users/credits 同规则）。 */
export const escapeCsv = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
