// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { adminSettingsRouter } from '@/business/server/lambda-routers/admin/settings';
import { getServerDB } from '@/database/server';

import { POST } from './route';

vi.mock('@/business/server/lambda-routers/admin/settings', () => ({
  adminSettingsRouter: { createCaller: vi.fn() },
}));

vi.mock('@/database/server', () => ({
  getServerDB: vi.fn(),
}));

const createDb = (adminUser?: { id: string } | null) =>
  ({
    query: {
      appSettings: { findFirst: vi.fn().mockResolvedValue(undefined) },
      users: { findFirst: vi.fn().mockResolvedValue(adminUser ?? null) },
    },
  }) as any;

const createRequest = (token?: string, body?: Record<string, unknown>) =>
  new Request('https://example.com/api/admin/maintenance', {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json',
    },
    method: 'POST',
  }) as any;

const createCallerMock = (runMaintenance: ReturnType<typeof vi.fn>) => {
  vi.mocked(adminSettingsRouter.createCaller).mockReturnValue(
    { runMaintenance } as any,
  );
  return runMaintenance;
};

describe('admin maintenance route (shared implementation forward)', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'environment-maintenance-secret';
    vi.clearAllMocks();
    vi.mocked(getServerDB).mockResolvedValue(createDb({ id: 'admin-actor-1' }));
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.MAINTENANCE_ACTOR_USER_ID;
  });

  it('keeps missing and incorrect bearer tokens unauthorized', async () => {
    const runMaintenance = createCallerMock(vi.fn());

    await expect(POST(createRequest())).resolves.toMatchObject({ status: 401 });
    await expect(POST(createRequest('wrong-secret'))).resolves.toMatchObject({ status: 401 });
    expect(runMaintenance).not.toHaveBeenCalled();
  });

  it('fails closed instead of using CRON_SECRET for invalid ciphertext', async () => {
    process.env.CRON_SECRET = 'environment-maintenance-secret';
    const db = createDb();
    db.query.appSettings = {
      findFirst: vi.fn().mockResolvedValue({ value: 'invalid-encrypted-value' }),
    };
    vi.mocked(getServerDB).mockResolvedValue(db);
    const runMaintenance = createCallerMock(vi.fn());

    await expect(POST(createRequest('environment-maintenance-secret'))).resolves.toMatchObject({
      status: 401,
    });
    expect(runMaintenance).not.toHaveBeenCalled();
  });

  it('forwards the maintenance request through the shared tRPC implementation', async () => {
    const runMaintenance = createCallerMock(
      vi.fn().mockResolvedValue({ moduleAppUploadsExpired: 4, ok: true }),
    );

    const response = await POST(
      createRequest('environment-maintenance-secret', {
        auditRetentionDays: 30,
        pendingOrderExpiryDays: 14,
        skipAudit: true,
        skipOrders: true,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      channel: 'cron',
      moduleAppUploadsExpired: 4,
      ok: true,
    });
    expect(runMaintenance).toHaveBeenCalledWith(
      expect.objectContaining({
        auditRetentionDays: 30,
        command: { actionId: 'setting.runMaintenance', confirmed: true },
        pendingOrderExpiryDays: 14,
        skipAudit: true,
        skipOrders: true,
      }),
    );
  });

  it('requires a maintenance actor for the audit foreign key', async () => {
    createCallerMock(vi.fn());
    vi.mocked(getServerDB).mockResolvedValue(createDb(undefined));

    await expect(POST(createRequest('environment-maintenance-secret'))).resolves.toMatchObject({
      status: 503,
    });
  });

  it('prefers the explicit maintenance actor environment over the admin fallback', async () => {
    const runMaintenance = createCallerMock(vi.fn().mockResolvedValue({ ok: true }));
    process.env.MAINTENANCE_ACTOR_USER_ID = 'explicit-actor';

    await POST(createRequest('environment-maintenance-secret'));

    const callerCtx = vi.mocked(adminSettingsRouter.createCaller).mock.calls[0]?.[0] as {
      userId: string;
    };
    expect(callerCtx.userId).toBe('explicit-actor');
    expect(runMaintenance).toHaveBeenCalled();
  });
});
