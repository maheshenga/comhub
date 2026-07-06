import { describe, expect, it } from 'vitest';

import { formatCreditLedgerDescription } from './ledgerDisplay';

describe('formatCreditLedgerDescription', () => {
  it('hides provider UUIDs from model consumption descriptions', () => {
    expect(
      formatCreditLedgerDescription('Consumed on 757e1732-8478-4c93-a4dd-1e17489a9c48/deepseek-v4-pro'),
    ).toBe('模型调用：deepseek-v4-pro');
  });

  it('keeps readable provider names when available', () => {
    expect(formatCreditLedgerDescription('Consumed on siliconflow/deepseek-v3')).toBe(
      '模型调用：deepseek-v3 · 服务商：siliconflow',
    );
  });

  it('falls back to the original description for non-model ledger text', () => {
    expect(formatCreditLedgerDescription('Manual top-up')).toBe('Manual top-up');
  });
});
