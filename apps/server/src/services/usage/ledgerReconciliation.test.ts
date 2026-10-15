import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type LobeChatDatabase } from '@/database/type';

import { BILLABLE_LEDGER_REFERENCE_TYPES, findBillableLedgerUsage } from './ledgerReconciliation';

/**
 * F7（usd 美元口径修复）锚定用例：mapBillableLedgerUsage 的 spend 必须
 * usdCost-first —— billing 写入 metadata.usdCost 时优先采用（credits↔USD
 * 换算是取整近似），缺失/无效时才回退 |amount|/CREDITS_PER_DOLLAR（即
 * 1_000_000 credits / 1e6）。与同文件 findAssistantMessageLedgerUsage 的
 * 既有 usdCost-first 模式保持一致。
 */
describe('findBillableLedgerUsage', () => {
  let mockDb: LobeChatDatabase;

  const baseRow = {
    amount: -1_000_000,
    createdAt: new Date('2024-01-18T10:00:00Z'),
    description: 'AI Embeddings Usage',
    id: 'ledger-embeddings',
    referenceId: 'embeddings:1',
    referenceType: 'model_runtime_embeddings',
    title: 'AI Embeddings Usage',
    updatedAt: new Date('2024-01-18T10:00:00Z'),
    userId: 'user-1',
  };

  const setupLedgerOnlyDb = (rows: unknown[]) => {
    const ledgerWhere = vi.fn().mockResolvedValue(rows);
    const ledgerFrom = vi.fn().mockReturnValue({ where: ledgerWhere });
    mockDb = {
      select: vi.fn().mockReturnValue({ from: ledgerFrom }),
    } as unknown as LobeChatDatabase;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers metadata.usdCost over the credits fallback for embeddings rows', async () => {
    // 1_000_000 credits 换算回退应为 1 USD；billing 写入的 0.42 必须胜出。
    setupLedgerOnlyDb([
      {
        ...baseRow,
        metadata: {
          model: 'text-embedding-3-small',
          provider: 'newapi',
          totalInputTokens: 12,
          totalOutputTokens: 0,
          totalTokens: 12,
          usdCost: 0.42,
        },
      },
    ]);

    const records = await findBillableLedgerUsage(mockDb, 'user-1', '2024-01-01', '2024-01-31');

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ credits: 1_000_000, id: 'ledger-embeddings', spend: 0.42 });
    expect(records[0].type).toBe('embedding');
  });

  it('falls back to credits / CREDITS_PER_DOLLAR when metadata has no usdCost', async () => {
    setupLedgerOnlyDb([{ ...baseRow, metadata: { totalInputTokens: 12 } }]);

    const records = await findBillableLedgerUsage(mockDb, 'user-1', '2024-01-01', '2024-01-31');

    expect(records).toHaveLength(1);
    expect(records[0].spend).toBe(1);
  });

  it('falls back when usdCost is not a positive finite number', async () => {
    setupLedgerOnlyDb([
      { ...baseRow, metadata: { usdCost: 0 } },
      { ...baseRow, metadata: { usdCost: Number.NaN }, referenceId: 'embeddings:2' },
      { ...baseRow, metadata: { usdCost: -3 }, referenceId: 'embeddings:3' },
    ]);

    const records = await findBillableLedgerUsage(mockDb, 'user-1', '2024-01-01', '2024-01-31');

    expect(records.map((record) => record.spend)).toEqual([1, 1, 1]);
  });

  it('keeps the billable reference type list intact', () => {
    expect(BILLABLE_LEDGER_REFERENCE_TYPES).toEqual([
      'image_generation',
      'model_runtime_embeddings',
      'model_runtime_generate_object',
      'ppt_generation',
      'video_generation',
    ]);
  });
});
