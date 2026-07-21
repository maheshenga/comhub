// @vitest-environment node
import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';
import { getDesktopReleaseDiagnostics } from '@/server/services/desktopRelease';

import { loadAppSettingsSectionSnapshot } from '../../appSettings/loader';
import { adminDesktopRouter } from './desktop';

const adminRouterSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/server/services/desktopRelease', () => ({
  getDesktopReleaseDiagnostics: vi.fn(),
}));

vi.mock('../../appSettings/loader', () => ({
  loadAppSettingsSectionSnapshot: vi.fn(),
}));

const createDb = (role = 'system_admin') =>
  ({
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue({ banned: false, role }),
      },
    },
  }) as any;

describe('adminDesktopRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerDB).mockResolvedValue(createDb());
    vi.mocked(loadAppSettingsSectionSnapshot).mockResolvedValue(
      new Map([
        ['desktop.update.channel', 'stable'],
        ['desktop.update.currentVersion', '2.2.7'],
        ['desktop.update.serverUrl', 'https://releases.example.com'],
        ['desktop.oss.accessKeySecret', 'must-not-leak'],
      ]) as any,
    );
    vi.mocked(getDesktopReleaseDiagnostics).mockResolvedValue({
      baseUrl: 'https://releases.example.com',
      channels: [],
      checkedAt: '2026-07-21T00:00:00.000Z',
      configured: true,
    });
  });

  it('is registered under admin.desktop', () => {
    expect(adminRouterSource).toContain("import { adminDesktopRouter } from './desktop';");
    expect(adminRouterSource).toMatch(/\bdesktop:\s*adminDesktopRouter\b/);
  });

  it('uses the configured update server without exposing OSS credentials', async () => {
    const result = await adminDesktopRouter
      .createCaller({ userId: 'system-admin-user' } as any)
      .getOverview();

    expect(loadAppSettingsSectionSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      'desktop-update',
    );
    expect(getDesktopReleaseDiagnostics).toHaveBeenCalledWith({
      baseUrl: 'https://releases.example.com',
    });
    expect(result).toMatchObject({
      configuredChannel: 'stable',
      configuredVersion: '2.2.7',
      diagnostics: { configured: true },
    });
    expect(result).not.toHaveProperty('desktopOssConfig');
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  it('requires the systemRead capability', async () => {
    vi.mocked(getServerDB).mockResolvedValue(createDb('finance_admin'));

    await expect(
      adminDesktopRouter.createCaller({ userId: 'finance-admin-user' } as any).getOverview(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(getDesktopReleaseDiagnostics).not.toHaveBeenCalled();
  });
});
