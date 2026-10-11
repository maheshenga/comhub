import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { formatCredits, formatCreditsAmount, formatSignedCredits } from './creditsDisplay';

const readSource = (relativePath: string) => readFile(path.join(process.cwd(), relativePath), 'utf8');

describe('credits unit display contract', () => {
  // 1 原子积分 = 0.000001 M。通用 2 位小数的 formatter 会把 atomic=5000
  // 显示成 "0.01 M"（真实 0.005，误差 2 倍）、把 atomic=100 显示成 "0 M"，
  // 两条都必须是下面的精确值，否则口径又漂回去了。
  it('keeps sub-cent credits instead of rounding them away', () => {
    expect(formatCredits(5000)).toBe('0.005 M');
    expect(formatCredits(100)).toBe('0.0001 M');
    expect(formatCredits(1)).toBe('0.000001 M');
    expect(formatSignedCredits(-5000)).toBe('-0.005 M');
  });

  it('converts atomic credits to display units before formatting', () => {
    // 1_000_000 原子积分 = 1 M。没做换算的话这里会输出 "1000000 M"。
    expect(formatCredits(1_000_000)).toBe('1 M');
    expect(formatCredits(1_234_567)).toBe('1.234567 M');
    expect(formatSignedCredits(1_000_000)).toBe('+1 M');
    expect(formatSignedCredits(0)).toBe('0 M');
  });

  it('leaves the generic business number precision untouched', async () => {
    // 2 位小数的通用 formatter 仍服务于金额等场景；本批只加 credits 专用函数，
    // 不能顺手把 formatBusinessNumber 的精度也改掉。
    expect(formatCreditsAmount(1.234_567)).toBe('1.234567');
    const shared = await readSource('src/business/client/BusinessSettingPages/shared.tsx');
    expect(shared).toContain('maximumFractionDigits: 2');
  });

  // 渲染层守卫：这两个页面曾经各写各的格式化器，导致同一个数在两个页面
  // 相差 1e6 倍。断言必须落到「credits 那一列」上——文件里别处还有
  // formatCredits（移动端分支），只做全文 toContain 的话，把 columns 里
  // 的 credits 单独改回 formatNumber 也不会变红（实测过，是假绿）。
  it('routes the credits column of the usage table through formatCredits', async () => {
    const source = await readSource(
      'src/features/Settings/stats/features/usage/UsageTable.tsx',
    );
    const creditsColumn = source.slice(
      source.indexOf("dataIndex: 'credits'"),
      source.indexOf("dataIndex: 'credits'") + 400,
    );

    expect(creditsColumn).toContain('formatCredits(record.credits ?? 0)');
    expect(creditsColumn).not.toContain('formatNumber(record.credits');
    expect(source).not.toContain('formatAtomicCredits');
  });

  it('routes the usage page quota cards through formatCredits', async () => {
    const source = await readSource('src/business/client/BusinessSettingPages/Usage.tsx');

    // formatAtomicCredits 曾把原子值直接当千分位整数渲染，与 Credits/Plans
    // 页的 "N M" 相差 1e6 倍。
    expect(source).not.toContain('formatAtomicCredits');
    expect(source).toContain('formatter: formatCredits');
  });
});
