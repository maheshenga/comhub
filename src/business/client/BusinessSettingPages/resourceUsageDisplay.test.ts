import { describe, expect, it } from 'vitest';

import { buildResourceUsageTiles, formatStorageSize, getUsagePercent } from './resourceUsageDisplay';

describe('resourceUsageDisplay', () => {
  it('calculates capped usage percent', () => {
    expect(getUsagePercent(50, 100)).toBe(50);
    expect(getUsagePercent(150, 100)).toBe(100);
    expect(getUsagePercent(50, null)).toBe(0);
  });

  it('formats storage sizes for usage summaries', () => {
    expect(formatStorageSize(512 * 1024)).toBe('512 KB');
    expect(formatStorageSize(128 * 1024 * 1024)).toBe('128 MB');
    expect(formatStorageSize(1536 * 1024 * 1024)).toBe('1.5 GB');
  });

  it('builds official-style resource usage tiles', () => {
    expect(
      buildResourceUsageTiles({
        storage: { quota: 1024 * 1024 * 1024, used: 512 * 1024 * 1024 },
        vector: { quota: 1200, used: 300 },
      }),
    ).toEqual([
      { caption: '512 MB / 1 GB', percent: 50, title: '文件存储' },
      { caption: '300 / 1200', percent: 25, title: '向量条数' },
    ]);
  });
});
