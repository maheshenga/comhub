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
    loadingText: 'Loading',
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

let swrData:
  | {
      authTitle: string;
      copyrightText: string;
      faviconUrl: null;
      loadingText: null | string;
      logoUrl: null;
      name: string;
      primaryColor: null;
      slogan: null;
      defaultSkillName?: string;
    }
  | undefined;

vi.mock('swr', () => ({
  default: () => ({
    data: swrData,
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
    swrData = {
      authTitle: 'Runtime auth title',
      copyrightText: '2026 Runtime',
      faviconUrl: null,
      loadingText: 'Runtime loading',
      logoUrl: null,
      name: 'Runtime Brand',
      primaryColor: null,
      slogan: null,
      defaultSkillName: 'Runtime Skill',
    };
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

  it('uses the server-provided brand before the public brand request resolves', async () => {
    swrData = undefined;

    render(
      <BrandProvider
        initialBrand={{
          authTitle: 'Server auth title',
          copyrightText: '2026 Server',
          faviconUrl: null,
          loadingText: null,
          logoUrl: null,
          name: 'Server Brand',
          primaryColor: null,
          slogan: null,
        }}
      >
        <div>content</div>
      </BrandProvider>,
    );

    await waitFor(() => {
      expect(document.title).toBe('Server Brand');
      expect(i18n.options?.interpolation?.defaultVariables?.brandName).toBe('Server Brand');
    });
  });

  it('exposes the configured default skill name from the public brand config', async () => {
    render(
      <BrandProvider>
        <div>content</div>
      </BrandProvider>,
    );

    await waitFor(() => {
      expect(i18n.options?.interpolation?.defaultVariables?.defaultSkillName).toBe('Runtime Skill');
    });
  });
});
