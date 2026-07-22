// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_SETTING_KEYS, invalidateServerAppSettings } from '@/server/services/appSettings';
import {
  APP_SETTING_SECRET_PREFIX,
  encryptAppSettingSecret,
} from '@/server/services/appSettings/secrets';

import { POST } from '../route';

const { mockGetServerDB, mockReleaseModel } = vi.hoisted(() => ({
  mockGetServerDB: vi.fn(),
  mockReleaseModel: {
    getRelease: vi.fn(),
    markReleaseResult: vi.fn(),
  },
}));

vi.mock('@/database/server', () => ({
  getServerDB: mockGetServerDB,
}));
vi.mock('@/database/models/desktopBuild', () => ({
  DesktopBuildModel: vi.fn(() => mockReleaseModel),
}));

vi.mock('@/server/services/appSettings', async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...(actual as object),
    invalidateServerAppSettings: vi.fn(),
  };
});

const TEST_KEY_VAULTS_SECRET = Buffer.alloc(32, 17).toString('base64');

const createRequest = (body: unknown, token = 'dedicated-secret') =>
  new Request('https://chat.qingyouai.com/api/admin/desktop-release', {
    body: JSON.stringify(body),
    headers: {
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json',
    },
    method: 'POST',
  }) as any;

const createDb = (legacySecret: unknown = 'legacy-secret') => {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));

  const db = {
    insert,
    query: {
      appSettings: {
        findFirst: vi.fn().mockResolvedValue({ value: legacySecret }),
      },
    },
    transaction: vi.fn(async (handler: (tx: unknown) => Promise<unknown>) => handler(db)),
  } as any;

  return { db, insert, values };
};

describe('POST /api/admin/desktop-release', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DESKTOP_RELEASE_TOKEN = 'dedicated-secret';
    process.env.KEY_VAULTS_SECRET = TEST_KEY_VAULTS_SECRET;
    mockReleaseModel.getRelease.mockResolvedValue({
      frozenRevisionId: '22222222-2222-4222-8222-222222222222',
      id: '11111111-1111-4111-8111-111111111111',
      status: 'building',
    });
    mockReleaseModel.markReleaseResult.mockImplementation(async (input: any) => ({
      ...input,
      id: input.releaseId,
    }));
  });

  afterEach(() => {
    delete process.env.ALLOW_LEGACY_CRON_SECRET_FOR_DESKTOP_RELEASE;
    delete process.env.CRON_SECRET;
    delete process.env.DESKTOP_RELEASE_TOKEN;
    delete process.env.KEY_VAULTS_SECRET;
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

  it.each([
    ['serverUrl', 'http://updates.example.com'],
    ['serverUrl', 'https://release-user:secret@updates.example.com'],
    ['downloadUrl', 'javascript:alert(1)'],
    ['downloadUrl', 'https://127.0.0.1/app.exe'],
  ])('rejects unsafe %s values from release callbacks', async (field, value) => {
    const { db, insert } = createDb();
    mockGetServerDB.mockResolvedValue(db);

    const response = await POST(createRequest({ [field]: value, version: '2.3.0' }));

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('does not accept cron.secret unless the legacy bridge is explicitly enabled', async () => {
    delete process.env.DESKTOP_RELEASE_TOKEN;
    const { db, insert } = createDb('legacy-secret');
    mockGetServerDB.mockResolvedValue(db);

    const response = await POST(createRequest({ version: '2.3.0' }, 'legacy-secret'));

    expect(response.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('uses encrypted cron.secret only when dedicated auth is absent and legacy sharing is enabled', async () => {
    delete process.env.DESKTOP_RELEASE_TOKEN;
    process.env.ALLOW_LEGACY_CRON_SECRET_FOR_DESKTOP_RELEASE = '1';
    const encrypted = await encryptAppSettingSecret(APP_SETTING_KEYS.cronSecret, 'legacy-secret');
    const { db } = createDb(encrypted);
    mockGetServerDB.mockResolvedValue(db);

    const response = await POST(createRequest({ version: '2.3.0' }, 'legacy-secret'));

    expect(response.status).toBe(200);
  });

  it('fails closed for invalid encrypted legacy auth without using CRON_SECRET', async () => {
    delete process.env.DESKTOP_RELEASE_TOKEN;
    process.env.ALLOW_LEGACY_CRON_SECRET_FOR_DESKTOP_RELEASE = '1';
    process.env.CRON_SECRET = 'environment-legacy-secret';
    const { db, insert } = createDb(
      `${APP_SETTING_SECRET_PREFIX}${APP_SETTING_KEYS.cronSecret}:invalid`,
    );
    mockGetServerDB.mockResolvedValue(db);

    const response = await POST(createRequest({ version: '2.3.0' }, 'environment-legacy-secret'));

    expect(response.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('gives DESKTOP_RELEASE_TOKEN precedence over an enabled legacy bridge', async () => {
    process.env.ALLOW_LEGACY_CRON_SECRET_FOR_DESKTOP_RELEASE = '1';
    const { db, insert } = createDb('legacy-secret');
    mockGetServerDB.mockResolvedValue(db);

    const response = await POST(createRequest({ version: '2.3.0' }, 'legacy-secret'));

    expect(response.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('preserves the manual callback path when releaseId is absent', async () => {
    const { db, values } = createDb();
    mockGetServerDB.mockResolvedValue(db);

    const response = await POST(createRequest({ version: '2.3.0' }));

    expect(response.status).toBe(200);
    expect(mockReleaseModel.getRelease).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.desktopUpdateCurrentVersion,
      value: '2.3.0',
    });
  });

  it('preserves manual callback compatibility when unknown release fields are present without releaseId', async () => {
    const { db } = createDb();
    mockGetServerDB.mockResolvedValue(db);

    const response = await POST(
      createRequest({
        status: 'succeeded',
        version: '2.3.0',
        workflowRunId: '1234567890',
        workflowRunUrl: 'https://github.com/maheshenga/comhub/actions/runs/1234567890',
      }),
    );

    expect(response.status).toBe(200);
    expect(mockReleaseModel.getRelease).not.toHaveBeenCalled();
  });

  it('binds release callbacks to their frozen revision and durable GitHub run metadata', async () => {
    const { db, values } = createDb();
    mockGetServerDB.mockResolvedValue(db);

    const response = await POST(
      createRequest({
        profileRevisionId: '22222222-2222-4222-8222-222222222222',
        releaseId: '11111111-1111-4111-8111-111111111111',
        status: 'building',
        version: '2.3.0',
        workflowRunId: '1234567890',
        workflowRunUrl: 'https://github.com/maheshenga/comhub/actions/runs/1234567890',
      }),
    );

    expect(response.status).toBe(200);
    expect(mockReleaseModel.markReleaseResult).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseId: '11111111-1111-4111-8111-111111111111',
        status: 'building',
        workflowRunId: '1234567890',
        workflowRunUrl: 'https://github.com/maheshenga/comhub/actions/runs/1234567890',
      }),
      expect.anything(),
    );
    expect(values).not.toHaveBeenCalled();
  });

  it('rejects mismatched profile revisions, invalid GitHub run URLs, and terminal callbacks', async () => {
    const { db, insert } = createDb();
    mockGetServerDB.mockResolvedValue(db);
    mockReleaseModel.getRelease.mockResolvedValueOnce({
      frozenRevisionId: '33333333-3333-4333-8333-333333333333',
      id: '11111111-1111-4111-8111-111111111111',
      status: 'building',
    });

    const mismatch = await POST(
      createRequest({
        profileRevisionId: '22222222-2222-4222-8222-222222222222',
        releaseId: '11111111-1111-4111-8111-111111111111',
        status: 'publishing',
        version: '2.3.0',
      }),
    );
    expect(mismatch.status).toBe(409);

    const invalidUrl = await POST(
      createRequest({
        profileRevisionId: '22222222-2222-4222-8222-222222222222',
        releaseId: '11111111-1111-4111-8111-111111111111',
        status: 'building',
        version: '2.3.0',
        workflowRunId: '1234567890',
        workflowRunUrl: 'https://github.com/other/repository/actions/runs/1234567890',
      }),
    );
    expect(invalidUrl.status).toBe(400);

    mockReleaseModel.markReleaseResult.mockRejectedValueOnce(new Error('DESKTOP_RELEASE_TERMINAL'));
    const terminal = await POST(
      createRequest({
        profileRevisionId: '22222222-2222-4222-8222-222222222222',
        releaseId: '11111111-1111-4111-8111-111111111111',
        status: 'succeeded',
        version: '2.3.0',
      }),
    );
    expect(terminal.status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
  });

  it('updates public settings only after a succeeded release within the release transaction', async () => {
    const { db, values } = createDb();
    mockGetServerDB.mockResolvedValue(db);

    const response = await POST(
      createRequest({
        profileRevisionId: '22222222-2222-4222-8222-222222222222',
        releaseId: '11111111-1111-4111-8111-111111111111',
        status: 'succeeded',
        version: '2.3.0',
      }),
    );

    expect(response.status).toBe(200);
    expect(db.transaction).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.desktopUpdateCurrentVersion,
      value: '2.3.0',
    });
  });
});
