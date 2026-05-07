import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('desktop env defaults', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.OFFICIAL_CLOUD_SERVER;
  });

  it('defaults the Windows client cloud server to QingyouAI chat', async () => {
    const { getDesktopEnv } = await import('../env');

    expect(getDesktopEnv().OFFICIAL_CLOUD_SERVER).toBe('https://chat.qingyouai.com/');
  });
});
