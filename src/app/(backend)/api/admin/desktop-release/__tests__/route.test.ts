import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_SETTING_KEYS, invalidateServerAppSettings } from '@/server/services/appSettings';

import { POST } from '../route';

const { mockGetServerDB } = vi.hoisted(() => ({
  mockGetServerDB: vi.fn(),
}));

vi.mock('@/database/server', () => ({
  getServerDB: mockGetServerDB,
}));

vi.mock('@/server/services/appSettings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/services/appSettings')>()),
  invalidateServerAppSettings: vi.fn(),
}));

const createRequest = (body: unknown, token = 'secret') =>
  new Request('https://chat.qingyouai.com/api/admin/desktop-release', {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    method: 'POST',
  }) as any;

const createDb = () => {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));

  const db = {
    insert,
    query: {
      appSettings: {
        findFirst: vi.fn().mockResolvedValue({ value: 'secret' }),
      },
    },
    transaction: vi.fn(async (handler: (tx: unknown) => Promise<unknown>) => handler(db)),
  } as any;

  return { db, insert, values };
};

describe('POST /api/admin/desktop-release', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without the release token', async () => {
    const { db, insert } = createDb();
    mockGetServerDB.mockResolvedValue(db);

    const response = await POST(createRequest({ version: '2.3.0' }, 'wrong'));

    expect(response.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('updates desktop release settings after a successful desktop build', async () => {
    const { db, values } = createDb();
    mockGetServerDB.mockResolvedValue(db);

    const response = await POST(
      createRequest({
        channel: 'stable',
        downloadUrl: 'https://cdn.qingyouai.com/desktop/stable/2.3.0/LobeHub-2.3.0-setup.exe',
        releaseNotes: '- desktop fixes',
        serverUrl: 'https://cdn.qingyouai.com/desktop',
        version: '2.3.0',
      }),
    );

    expect(response.status).toBe(200);
    expect(values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.desktopUpdateCurrentVersion,
      value: '2.3.0',
    });
    expect(values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.desktopUpdateServerUrl,
      value: 'https://cdn.qingyouai.com/desktop',
    });
    expect(values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.desktopDownloadUrl,
      value: 'https://cdn.qingyouai.com/desktop/stable/2.3.0/LobeHub-2.3.0-setup.exe',
    });
    expect(invalidateServerAppSettings).toHaveBeenCalledTimes(1);
  });
});
