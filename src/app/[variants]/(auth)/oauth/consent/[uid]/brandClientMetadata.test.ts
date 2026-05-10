import { describe, expect, it } from 'vitest';

import { resolveBrandedClientMetadata } from './brandClientMetadata';

describe('resolveBrandedClientMetadata', () => {
  it('uses runtime brand for the built-in desktop OAuth client', () => {
    const metadata = resolveBrandedClientMetadata({
      brand: {
        authTitle: null,
        copyrightText: null,
        faviconUrl: null,
        loadingText: null,
        logoUrl: '/brand/logo.png',
        name: 'Qingyou AI',
        primaryColor: null,
        slogan: null,
      },
      clientId: 'lobehub-desktop',
      metadata: {
        clientName: 'LobeHub Desktop',
        isFirstParty: true,
        logo: 'https://example.com/lobehub.png',
      },
    });

    expect(metadata).toEqual({
      clientName: 'Qingyou AI Desktop',
      isFirstParty: true,
      logo: '/brand/logo.png',
    });
  });

  it('keeps third-party OAuth clients unchanged', () => {
    const metadata = {
      clientName: 'External App',
      isFirstParty: false,
      logo: 'https://example.com/app.png',
    };

    expect(
      resolveBrandedClientMetadata({
        brand: {
          authTitle: null,
          copyrightText: null,
          faviconUrl: null,
          loadingText: null,
          logoUrl: '/brand/logo.png',
          name: 'Qingyou AI',
          primaryColor: null,
          slogan: null,
        },
        clientId: 'external-app',
        metadata,
      }),
    ).toBe(metadata);
  });
});
