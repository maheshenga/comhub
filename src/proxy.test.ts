/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/libs/next/proxy/define-config', () => ({
  defineConfig: () => ({ middleware: vi.fn() }),
}));

describe('production proxy matcher', () => {
  it('includes mobile workspace deep links', async () => {
    const { config } = await import('./proxy');

    expect(config.matcher).toEqual(
      expect.arrayContaining(['/design', '/apps', '/apps(.*)', '/discover']),
    );
  });
});
