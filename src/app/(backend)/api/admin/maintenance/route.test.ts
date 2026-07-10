import { beforeEach, describe, expect, it, vi } from 'vitest';

import { syncExpiredSubscriptionsToFree } from '@/business/server/subscriptionMaintenance';
import { getServerDB } from '@/database/server';

import { POST } from './route';

const cleanupMocks = vi.hoisted(() => ({
  cleanupExpiredUploads: vi.fn(),
}));

vi.mock('@/database/server', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/business/server/subscriptionMaintenance', () => ({
  syncExpiredSubscriptionsToFree: vi.fn(),
}));

vi.mock('@/server/services/moduleAppPackage/lifecycle', () => ({
  ModuleAppPackageLifecycleService: vi.fn(() => cleanupMocks),
}));

const createDb = () =>
  ({
    query: {
      appSettings: {
        findFirst: vi.fn().mockResolvedValue({ value: 'maintenance-secret' }),
      },
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

describe('admin maintenance route module app cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerDB).mockResolvedValue(createDb());
    vi.mocked(syncExpiredSubscriptionsToFree).mockResolvedValue({
      expiredSnapshots: 2,
      freeSnapshotsCreated: 1,
    });
    cleanupMocks.cleanupExpiredUploads.mockResolvedValue({ expired: 4, failed: 1 });
  });

  it('keeps missing and incorrect bearer tokens unauthorized', async () => {
    await expect(POST(createRequest())).resolves.toMatchObject({ status: 401 });
    await expect(POST(createRequest('wrong-secret'))).resolves.toMatchObject({ status: 401 });
    expect(cleanupMocks.cleanupExpiredUploads).not.toHaveBeenCalled();
  });

  it('runs bounded module app cleanup for an authenticated request', async () => {
    const response = await POST(
      createRequest('maintenance-secret', { skipAudit: true, skipOrders: true }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      moduleAppUploadCleanupFailed: 1,
      moduleAppUploadsExpired: 4,
      subscriptionSnapshotsExpired: 2,
    });
    expect(cleanupMocks.cleanupExpiredUploads).toHaveBeenCalledWith({ limit: 100 });
  });

  it('skips module app cleanup only when explicitly requested', async () => {
    const response = await POST(
      createRequest('maintenance-secret', {
        skipAudit: true,
        skipModuleAppUploads: true,
        skipOrders: true,
      }),
    );

    expect(response.status).toBe(200);
    expect(cleanupMocks.cleanupExpiredUploads).not.toHaveBeenCalled();
    expect(await response.json()).not.toHaveProperty('moduleAppUploadsExpired');
  });
});
