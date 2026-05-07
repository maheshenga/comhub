import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BrandProvider } from './BrandProvider';

vi.mock('@lobechat/business-const', () => ({
  BRANDING_NAME: 'LobeHub',
}));

vi.mock('@/const/brand', () => ({
  DEFAULT_RUNTIME_BRAND: {
    authTitle: 'Agent teammates that grow with you',
    copyrightText: '© 2026 青柚 AI. All rights reserved.',
    logoUrl: '/images/brand/qingyou-ai-logo.png',
    name: '青柚 AI',
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
      authTitle: '与团队一起成长的 AI 助手',
      copyrightText: '© 2026 玄果',
      faviconUrl: null,
      logoUrl: null,
      name: '玄果',
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
  });

  it('initializes i18n interpolation options when they are missing during SPA boot', async () => {
    render(
      <BrandProvider>
        <div>content</div>
      </BrandProvider>,
    );

    await waitFor(() => {
      expect(i18n.options?.interpolation?.defaultVariables?.brandName).toBe('玄果');
    });
  });
});
