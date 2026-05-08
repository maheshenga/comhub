import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BrandProvider } from './BrandProvider';

vi.mock('@lobechat/business-const', () => ({
  BRANDING_NAME: 'LobeHub',
}));

vi.mock('@/const/brand', () => ({
  DEFAULT_RUNTIME_BRAND: {
    authTitle: 'Agent teammates that grow with you',
    copyrightText: '2026 Qingyou AI. All rights reserved.',
    logoUrl: '/images/brand/qingyou-ai-logo.png',
    name: 'Qingyou AI',
    primaryColor: '#12b981',
  },
}));

const i18n = {
  options: undefined as
    | {
        interpolation?: {
          defaultVariables?: Record<string, string>;
        };
      }
    | undefined,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n }),
}));

vi.mock('swr', () => ({
  default: () => ({
    data: {
      authTitle: 'Runtime auth title',
      copyrightText: '2026 Runtime',
      faviconUrl: null,
      logoUrl: null,
      name: 'Runtime Brand',
      primaryColor: null,
      slogan: null,
    },
  }),
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    admin: {
      settings: {
        getPublicBrand: {
          query: vi.fn(),
        },
      },
    },
  },
}));

describe('BrandProvider', () => {
  beforeEach(() => {
    i18n.options = undefined;
    document.body.innerHTML = '';
  });

  it('initializes i18n interpolation options when they are missing during SPA boot', async () => {
    render(
      <BrandProvider>
        <div>content</div>
      </BrandProvider>,
    );

    await waitFor(() => {
      expect(i18n.options?.interpolation?.defaultVariables?.brandName).toBe('Runtime Brand');
    });
  });

  it('keeps the original loading SVG during SPA boot', async () => {
    document.body.innerHTML =
      '<div id="loading-brand" aria-label="Loading" role="status"><svg data-testid="original-loading-svg"><path /></svg></div>';

    render(
      <BrandProvider>
        <div>content</div>
      </BrandProvider>,
    );

    await waitFor(() => {
      expect(i18n.options?.interpolation?.defaultVariables?.brandName).toBe('Runtime Brand');
    });

    const loadingBrand = document.getElementById('loading-brand');
    expect(loadingBrand?.querySelector('[data-testid="original-loading-svg"]')).not.toBeNull();
    expect(loadingBrand?.querySelector('span')).toBeNull();
  });
});
