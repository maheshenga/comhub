import type { ModuleAppCapabilityClaims } from '@lobechat/types';
import { describe, expect, it, vi } from 'vitest';

import { ModuleAppFileGateway } from './files';
import { ModuleAppCapabilityGateway, ModuleAppReplayGuard } from './gateway';
import { ModuleAppHttpGateway } from './http';
import { ModuleAppNotificationGateway } from './notifications';
import { ModuleAppSecretsGateway } from './secrets';

const INSTALLATION_ID = '00000000-0000-4000-8000-000000000001';
const APP_ID = '00000000-0000-4000-8000-000000000002';
const VERSION_ID = '00000000-0000-4000-8000-000000000003';

const claims = (
  permissions: string[],
  surface: 'browser' | 'runtime' = 'browser',
): ModuleAppCapabilityClaims => ({
  appId: APP_ID,
  aud: 'module-runtime',
  exp: 1_783_760_300,
  iat: 1_783_760_000,
  installationId: INSTALLATION_ID,
  nonce: '0123456789abcdef0123456789abcdef',
  permissions,
  surface,
  userId: 'user-1',
  versionId: VERSION_ID,
});

const createGateway = (httpOverride?: ModuleAppHttpGateway) => {
  const storage = {
    createPrivatePreSignedUpload: vi.fn().mockResolvedValue({
      url: 'https://storage.example.com/upload',
    }),
    createPreSignedUrlForPreview: vi.fn().mockResolvedValue('https://storage.example.com/download'),
  };
  const files = new ModuleAppFileGateway({ randomId: () => 'file-1', storage: storage as never });
  const http = new ModuleAppHttpGateway({
    fetch: vi.fn(),
    resolveHostname: () => ['93.184.216.34'],
  });
  const notifications = new ModuleAppNotificationGateway({
    create: vi.fn().mockResolvedValue({ id: 'notification-1' }),
  });
  const secrets = new ModuleAppSecretsGateway({
    decrypt: vi.fn().mockResolvedValue({ plaintext: 'secret-value', wasAuthentic: true }),
    getEncryptedValue: vi.fn().mockResolvedValue('encrypted-value'),
  });
  const data = {
    archive: vi.fn(),
    get: vi.fn(),
    insert: vi.fn(),
    list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    transaction: vi.fn(),
    update: vi.fn(),
  };
  const gateway = new ModuleAppCapabilityGateway({
    context: {
      resolve: vi.fn().mockResolvedValue({
        appId: APP_ID,
        displayName: 'Example App',
        installationId: INSTALLATION_ID,
        outboundHosts: ['api.example.com'],
        scopeType: 'personal',
        userId: 'user-1',
        versionId: VERSION_ID,
      }),
    },
    data: data as never,
    files,
    http: httpOverride ?? http,
    notifications,
    replayGuard: new ModuleAppReplayGuard(),
    secrets,
  });

  return { data, gateway, storage };
};

describe('ModuleAppCapabilityGateway', () => {
  it('denies methods missing from the reviewed capability', async () => {
    const { gateway } = createGateway();

    await expect(
      gateway.call({
        capability: claims(['data.read']),
        input: { fileName: 'report.csv' },
        method: 'files.createUpload',
        requestId: 'request-1',
      }),
    ).rejects.toThrow('MODULE_APP_CAPABILITY_DENIED');
  });

  it('never returns secret plaintext to a browser capability', async () => {
    const { gateway } = createGateway();

    await expect(
      gateway.call({
        capability: claims(['secrets.read']),
        input: { key: 'CRM_TOKEN' },
        method: 'secrets.get',
      }),
    ).resolves.toEqual({ configured: true });
    await expect(
      gateway.call({
        capability: claims(['secrets.read'], 'runtime'),
        input: { key: 'CRM_TOKEN' },
        method: 'secrets.get',
      }),
    ).resolves.toEqual({ configured: true, value: 'secret-value' });
  });

  it('binds file keys to one installation and rejects cross-installation downloads', async () => {
    const { gateway, storage } = createGateway();

    await expect(
      gateway.call({
        capability: claims(['files.write']),
        input: { fileName: 'report.csv' },
        method: 'files.createUpload',
        requestId: 'request-1',
      }),
    ).resolves.toMatchObject({
      key: `${INSTALLATION_ID}/files/file-1.csv`,
      uploadUrl: 'https://storage.example.com/upload',
    });
    expect(storage.createPrivatePreSignedUpload).toHaveBeenCalledWith(
      `module-app-installations/${INSTALLATION_ID}/files/file-1.csv`,
    );

    await expect(
      gateway.call({
        capability: claims(['files.read']),
        input: { key: '00000000-0000-4000-8000-000000000099/files/stolen.csv' },
        method: 'files.createDownload',
      }),
    ).rejects.toThrow('MODULE_APP_FILE_SCOPE_DENIED');
  });

  it('applies the SSRF guard even when the host was reviewed', async () => {
    const unsafeHttp = new ModuleAppHttpGateway({
      fetch: vi.fn(),
      resolveHostname: () => ['169.254.169.254'],
    });
    const { gateway } = createGateway(unsafeHttp);

    await expect(
      gateway.call({
        capability: claims(['http.fetch']),
        input: { url: 'https://api.example.com/private' },
        method: 'http.fetch',
        requestId: 'request-2',
      }),
    ).rejects.toThrow('MODULE_APP_UNSAFE_API_URL');
  });

  it('rejects replayed mutation request ids for the same launch nonce', async () => {
    const { gateway } = createGateway();
    const call = () =>
      gateway.call({
        capability: claims(['notifications.write']),
        input: { content: 'Build complete', title: 'Done' },
        method: 'notifications.create' as const,
        requestId: 'request-replay',
      });

    await expect(call()).resolves.toMatchObject({ id: 'notification-1' });
    await expect(call()).rejects.toThrow('MODULE_APP_CAPABILITY_REPLAYED');
  });

  it('rate limits notifications per installation across distinct request ids', async () => {
    const { gateway } = createGateway();

    for (let index = 0; index < 10; index++) {
      await gateway.call({
        capability: claims(['notifications.write']),
        input: { content: 'Build complete', title: 'Done' },
        method: 'notifications.create',
        requestId: `request-${index}`,
      });
    }

    await expect(
      gateway.call({
        capability: claims(['notifications.write']),
        input: { content: 'One too many', title: 'Denied' },
        method: 'notifications.create',
        requestId: 'request-11',
      }),
    ).rejects.toThrow('MODULE_APP_NOTIFICATION_RATE_LIMITED');
  });

  it('rejects an oversized HTTP response before reading its body', async () => {
    const oversizedHttp = new ModuleAppHttpGateway({
      fetch: vi.fn().mockResolvedValue(
        new Response('not read', {
          headers: { 'content-length': String(1024 * 1024 + 1) },
          status: 200,
        }),
      ),
      resolveHostname: () => ['93.184.216.34'],
    });
    const { gateway } = createGateway(oversizedHttp);

    await expect(
      gateway.call({
        capability: claims(['http.fetch']),
        input: { url: 'https://api.example.com/large' },
        method: 'http.fetch',
        requestId: 'request-large',
      }),
    ).rejects.toThrow('MODULE_APP_HTTP_RESPONSE_TOO_LARGE');
  });

  it('routes managed data reads through the installation capability', async () => {
    const { data, gateway } = createGateway();
    await expect(
      gateway.call({
        capability: claims(['data.read']),
        input: { tableKey: 'candidates' },
        method: 'data.list',
      }),
    ).resolves.toEqual({ items: [], nextCursor: null });
    expect(data.list).toHaveBeenCalledWith({
      capability: expect.objectContaining({ installationId: INSTALLATION_ID }),
      input: { tableKey: 'candidates' },
    });
  });

  it('requires unique request ids for managed data mutations', async () => {
    const { data, gateway } = createGateway();
    data.insert.mockResolvedValue({ rowKey: 'candidate-1' });
    const call = () =>
      gateway.call({
        capability: claims(['data.write']),
        input: { tableKey: 'candidates', values: { email: 'one@example.com' } },
        method: 'data.insert',
        requestId: 'data-request-1',
      });

    await expect(call()).resolves.toMatchObject({ rowKey: 'candidate-1' });
    await expect(call()).rejects.toThrow('MODULE_APP_CAPABILITY_REPLAYED');
    expect(data.insert).toHaveBeenCalledOnce();
  });
});
