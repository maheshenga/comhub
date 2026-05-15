import { Plans } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_SETTING_KEYS } from '@/server/services/appSettings';

import { DocmeePptService } from './index';

const createDb = (overrides: any = {}) =>
  ({
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(),
        returning: vi.fn().mockResolvedValue([{ id: 'ledger-1' }]),
      })),
    })),
    query: {
      appSettings: { findMany: vi.fn().mockResolvedValue([]) },
      creditLedgerEntries: { findFirst: vi.fn() },
      planCatalog: { findFirst: vi.fn() },
      pptUsageRecords: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      userPlanSnapshots: { findFirst: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        for: vi.fn().mockResolvedValue([{ balance: 100 }]),
        where: vi.fn(() => ({
          for: vi.fn().mockResolvedValue([{ balance: 100 }]),
        })),
      })),
    })),
    transaction: vi.fn(async (fn) => fn(createDb(overrides))),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ balance: 88 }]),
        })),
      })),
    })),
    ...overrides,
  }) as any;

const enabledSettings = [
  { key: APP_SETTING_KEYS.docmeePptEnabled, value: true },
  { key: APP_SETTING_KEYS.docmeePptApiKey, value: 'sk-secret' },
];

describe('DocmeePptService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects token creation when PPT is disabled', async () => {
    const service = new DocmeePptService({ db: createDb(), userId: 'u1' });

    await expect(service.createToken()).rejects.toMatchObject({
      code: 'PPT_DISABLED',
    });
  });

  it('does not expose the configured API key in runtime', async () => {
    const db = createDb({
      query: {
        appSettings: {
          findMany: vi.fn().mockResolvedValue(enabledSettings),
        },
        planCatalog: { findFirst: vi.fn().mockResolvedValue({ metadata: { pptEnabled: true } }) },
        pptUsageRecords: { findMany: vi.fn().mockResolvedValue([]) },
        userPlanSnapshots: { findFirst: vi.fn().mockResolvedValue({ plan: Plans.Starter }) },
      },
    });
    const service = new DocmeePptService({ db, userId: 'u1' });

    const runtime = await service.getRuntime();

    expect(JSON.stringify(runtime)).not.toContain('sk-secret');
    expect(runtime).toMatchObject({ configured: true, enabled: true });
  });

  it('charges a successful generation only once for the same session', async () => {
    const tx = createDb({
      query: {
        creditLedgerEntries: { findFirst: vi.fn().mockResolvedValue(null) },
        pptUsageRecords: {
          findFirst: vi.fn().mockResolvedValue({
            chargedLedgerEntryId: null,
            creditCost: 12,
            id: 'usage-1',
            plan: Plans.Starter,
            sessionId: 's1',
          }),
        },
      },
    });
    const db = createDb({
      query: {
        appSettings: { findMany: vi.fn().mockResolvedValue(enabledSettings) },
        planCatalog: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ metadata: { pptCreditCost: 12, pptEnabled: true } }),
        },
        pptUsageRecords: { findMany: vi.fn().mockResolvedValue([]) },
        userPlanSnapshots: { findFirst: vi.fn().mockResolvedValue({ plan: Plans.Starter }) },
      },
      transaction: vi.fn(async (fn) => fn(tx)),
    });
    const service = new DocmeePptService({ db, userId: 'u1' });

    await expect(
      service.reportEvent({
        sessionId: 's1',
        type: 'afterGenerate',
        upstreamTaskId: 'task-1',
      }),
    ).resolves.toMatchObject({ charged: true });

    expect(tx.insert).toHaveBeenCalled();
  });
});
