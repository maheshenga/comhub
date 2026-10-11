import { toDisplayCredits } from '@lobechat/const/currency';

/**
 * 积分展示精度必须覆盖 1e-6 量级：1 原子积分 = 0.000001 M。若沿用通用的 2 位
 * 小数 formatter，atomic=5000 会被显示成 "0.01 M"（真实值 0.005，误差 2 倍）、
 * atomic=100 直接显示成 "0 M"。6 位口径与 Admin 侧 formatAdminCredits 对齐，
 * 两边不得再各自漂移。
 */
export const formatCreditsAmount = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value);

export const formatCredits = (value: number) =>
  `${formatCreditsAmount(toDisplayCredits(value))} M`;

export const formatSignedCredits = (value: number) =>
  `${value > 0 ? '+' : ''}${formatCreditsAmount(toDisplayCredits(value))} M`;

export type LedgerAllocationDisplayRecord = {
  metadata?: {
    allocations?: unknown;
  } | null;
  type?: string;
};

export type LedgerAllocationDisplayItem = {
  amount: number;
  source: string;
};

export const getNextCreditLedgerCursor = (page?: { nextCursor?: string | null }) =>
  page?.nextCursor ?? null;

export const normalizeLedgerAllocations = (
  record: LedgerAllocationDisplayRecord,
): LedgerAllocationDisplayItem[] => {
  if (record.type !== 'consume') return [];

  const allocations = record.metadata?.allocations;
  if (!Array.isArray(allocations) || allocations.length === 0) return [];

  return allocations.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];

    const amount = (item as { amount?: unknown }).amount;
    const source = (item as { source?: unknown }).source;

    if (typeof amount !== 'number' || !Number.isFinite(amount)) return [];
    if (typeof source !== 'string' || !source.trim()) return [];

    return [{ amount, source: source.trim() }];
  });
};

export const formatLedgerAllocationText = (
  record: LedgerAllocationDisplayRecord,
  getSourceLabel: (source: string) => string,
  formatAmount: (amount: number) => string,
  options: {
    prefix?: string;
    separator?: string;
  } = {},
) => {
  const allocations = normalizeLedgerAllocations(record);
  if (allocations.length === 0) return null;

  const prefix = options.prefix ?? '扣费来源：';
  const separator = options.separator ?? ' · ';

  return `${prefix}${allocations
    .map((item) => `${getSourceLabel(item.source)} ${formatAmount(item.amount)}`)
    .join(separator)}`;
};
