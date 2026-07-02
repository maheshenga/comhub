import { type ResourceUsageSummary } from '@/types/business';

export const getUsagePercent = (used: number, quota?: null | number) => {
  if (!quota || quota <= 0) return 0;

  return Math.min(100, Math.round((Math.max(0, used) / quota) * 100));
};

export const formatStorageSize = (bytes: number) => {
  const value = Math.max(0, bytes);
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${Math.round(value / 1024 / 1024)} MB`;

  return `${Number((value / 1024 / 1024 / 1024).toFixed(1))} GB`;
};

export const buildResourceUsageTiles = (summary?: ResourceUsageSummary) => [
  {
    caption:
      summary?.storage.quota == null
        ? `${formatStorageSize(summary?.storage.used ?? 0)} / 不限制`
        : `${formatStorageSize(summary.storage.used)} / ${formatStorageSize(summary.storage.quota)}`,
    percent: getUsagePercent(summary?.storage.used ?? 0, summary?.storage.quota),
    title: '文件存储',
  },
  {
    caption:
      summary?.vector.quota == null
        ? `${summary?.vector.used ?? 0} / 不限制`
        : `${summary.vector.used} / ${summary.vector.quota}`,
    percent: getUsagePercent(summary?.vector.used ?? 0, summary?.vector.quota),
    title: '向量条数',
  },
];
