import { afterEach, describe, expect, it, vi } from 'vitest';

const originalOfficialCloudServer = process.env.OFFICIAL_CLOUD_SERVER;

const reloadDesktopEnv = async () => {
  vi.resetModules();
  return import('./env');
};

afterEach(() => {
  if (originalOfficialCloudServer === undefined) {
    delete process.env.OFFICIAL_CLOUD_SERVER;
  } else {
    process.env.OFFICIAL_CLOUD_SERVER = originalOfficialCloudServer;
  }
  vi.resetModules();
});

describe('desktop env defaults', () => {
  it('defaults the official cloud server to Qingyou ComHub', async () => {
    delete process.env.OFFICIAL_CLOUD_SERVER;

    const { getDesktopEnv } = await reloadDesktopEnv();

    expect(getDesktopEnv().OFFICIAL_CLOUD_SERVER).toBe('https://chat.qingyouai.com');
  });

  it('allows release builds to override the official cloud server', async () => {
    process.env.OFFICIAL_CLOUD_SERVER = 'https://desktop.example.com';

    const { getDesktopEnv } = await reloadDesktopEnv();

    expect(getDesktopEnv().OFFICIAL_CLOUD_SERVER).toBe('https://desktop.example.com');
  });
});
