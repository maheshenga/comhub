import { describe, expect, it } from 'vitest';

import { defineConfig } from './define-config';

describe('defineConfig redirects', () => {
  it('leaves legacy discover paths to the user-agent-aware proxy', async () => {
    const redirects = await defineConfig({}).redirects!();

    expect(redirects).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: '/discover' }),
        expect.objectContaining({ source: '/discover/:path*' }),
      ]),
    );
  });
});
