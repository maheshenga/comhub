import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchRemoteUpdateConfig } from '../remoteConfig';

const { mockGetDesktopEnv, mockNetFetch } = vi.hoisted(() => ({
  mockGetDesktopEnv: vi.fn(() => ({
    OFFICIAL_CLOUD_SERVER: 'https://chat.qingyouai.com/',
  })),
  mockNetFetch: vi.fn(),
}));

vi.mock('electron', () => ({
  net: {
    fetch: mockNetFetch,
  },
}));

vi.mock('@/env', () => ({
  getDesktopEnv: mockGetDesktopEnv,
}));

vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('fetchRemoteUpdateConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDesktopEnv.mockReturnValue({
      OFFICIAL_CLOUD_SERVER: 'https://chat.qingyouai.com/',
    });
  });

  it('should read desktop update config from the tRPC data.json payload', async () => {
    mockNetFetch.mockResolvedValue({
      json: async () => ({
        result: {
          data: {
            json: {
              autoCheck: false,
              channel: 'canary',
              checkIntervalMinutes: 30,
              serverUrl: 'https://releases.qingyouai.com/releases',
            },
          },
        },
      }),
      ok: true,
    });

    const config = await fetchRemoteUpdateConfig();

    expect(config).toEqual({
      autoCheck: false,
      channel: 'canary',
      checkIntervalMinutes: 30,
      serverUrl: 'https://releases.qingyouai.com/releases',
    });
  });
});
