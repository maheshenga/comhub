import { describe, expect, it, vi } from 'vitest';

import type { App } from '@/core/App';

import BinaryCtr from '../BinaryCtr';

vi.mock('@/modules/binaries', () => ({
  detectHeterogeneousCliCommand: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('BinaryCtr', () => {
  it('exposes managed binary install/retry through the controller', async () => {
    const install = vi.fn().mockResolvedValue('/managed/bin/foo');
    const controller = new BinaryCtr({
      binaryManager: {
        install,
      },
    } as unknown as App);

    await expect(controller.install('foo')).resolves.toBe('/managed/bin/foo');
    expect(install).toHaveBeenCalledWith('foo', undefined);
  });
});
