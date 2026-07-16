import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';
import { APP_SETTING_KEYS } from '@/server/services/appSettings';

import * as appSettingsCatalog from '../../appSettings/catalog';
import { recordAdminAudit } from './audit';
import { adminPptRouter } from './ppt';

vi.mock('../../appSettings/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof appSettingsCatalog>();

  return {
    ...actual,
    normalizeAppSettingValue: vi.fn(actual.normalizeAppSettingValue),
  };
});

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('./audit', () => ({
  recordAdminAudit: vi.fn(),
}));

const createDb = () => {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));

  return {
    __mocks: { onConflictDoUpdate, values },
    insert: vi.fn(() => ({ values })),
    query: {
      appSettings: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
      },
    },
  } as any;
};

describe('adminPptRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes every dedicated setting write through the catalog contract', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    await adminPptRouter.createCaller({ userId: 'admin-user' } as any).saveSettings({
      apiKey: '  ppt-secret  ',
      dailyLimit: null,
      tokenTtlMinutes: 1440,
    });

    expect(appSettingsCatalog.normalizeAppSettingValue).toHaveBeenCalledWith(
      APP_SETTING_KEYS.docmeePptApiKey,
      '  ppt-secret  ',
      'adminPptRouter.saveSettings',
    );
    expect(appSettingsCatalog.normalizeAppSettingValue).toHaveBeenCalledWith(
      APP_SETTING_KEYS.docmeePptDailyLimit,
      null,
      'adminPptRouter.saveSettings',
    );
    expect(appSettingsCatalog.normalizeAppSettingValue).toHaveBeenCalledWith(
      APP_SETTING_KEYS.docmeePptTokenTtlMinutes,
      1440,
      'adminPptRouter.saveSettings',
    );
    expect(db.__mocks.values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.docmeePptApiKey,
      value: 'ppt-secret',
    });
    expect(db.__mocks.values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.docmeePptDailyLimit,
      value: null,
    });
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'ppt.settings.save' }),
    );
  });

  it('routes API-key clearing through the sensitive catalog contract', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    await adminPptRouter.createCaller({ userId: 'admin-user' } as any).saveSettings({
      clearApiKey: true,
    });

    expect(appSettingsCatalog.normalizeAppSettingValue).toHaveBeenCalledWith(
      APP_SETTING_KEYS.docmeePptApiKey,
      null,
      'adminPptRouter.saveSettings',
    );
    expect(db.__mocks.values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.docmeePptApiKey,
      value: null,
    });
  });

  it('keeps the catalog limits at nullable daily quota and a 1..1440 token TTL', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);
    const caller = adminPptRouter.createCaller({ userId: 'admin-user' } as any);

    await expect(caller.saveSettings({ dailyLimit: null, tokenTtlMinutes: 1 })).resolves.toEqual({
      ok: true,
    });
    await expect(caller.saveSettings({ tokenTtlMinutes: 0 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(caller.saveSettings({ tokenTtlMinutes: 1441 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
