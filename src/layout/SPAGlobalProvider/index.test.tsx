import { render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import SPAGlobalProvider from './index';

vi.mock('@lobehub/ui', () => ({
  ContextMenuHost: () => null,
  ModalHost: () => null,
  TooltipGroup: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('@lobehub/ui/base-ui', () => ({
  ModalHost: () => null,
  ToastHost: () => null,
}));

vi.mock('antd-style', () => ({
  StyleProvider: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('motion/react', () => ({
  LazyMotion: ({ children }: PropsWithChildren) => <>{children}</>,
  domMax: {},
}));

vi.mock('@/components/Analytics/LobeAnalyticsProviderWrapper', () => ({
  LobeAnalyticsProviderWrapper: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/components/DragUploadZone/DragUploadProvider', () => ({
  DragUploadProvider: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/const/version', () => ({
  isDesktop: false,
}));

vi.mock('@/layout/AuthProvider/index.vite', () => ({
  default: ({ children }: PropsWithChildren) => (
    <div data-testid="spa-auth-provider">{children}</div>
  ),
}));

vi.mock('@/layout/GlobalProvider/AppTheme', () => ({
  default: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/layout/GlobalProvider/DynamicFavicon', () => ({
  default: () => null,
}));

vi.mock('@/layout/GlobalProvider/FaviconProvider', () => ({
  FaviconProvider: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/layout/GlobalProvider/GroupWizardProvider', () => ({
  GroupWizardProvider: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/layout/GlobalProvider/ImportSettings', () => ({
  default: () => null,
}));

vi.mock('@/layout/GlobalProvider/NextThemeProvider', () => ({
  default: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/layout/GlobalProvider/Query', () => ({
  default: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/layout/GlobalProvider/ServerVersionOutdatedAlert', () => ({
  default: () => null,
}));

vi.mock('@/layout/GlobalProvider/StoreInitialization', () => ({
  default: () => <div data-testid="store-initialization" />,
}));

vi.mock('@/store/serverConfig/Provider', () => ({
  ServerConfigStoreProvider: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('./Locale', () => ({
  default: ({ children }: PropsWithChildren) => <>{children}</>,
}));

describe('SPAGlobalProvider', () => {
  it('uses the Vite AuthProvider so SPA sessions are synced into the user store', async () => {
    render(
      <SPAGlobalProvider>
        <div>SPA content</div>
      </SPAGlobalProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('spa-auth-provider')).toBeInTheDocument();
      expect(screen.getByTestId('store-initialization')).toBeInTheDocument();
      expect(screen.getByText('SPA content')).toBeInTheDocument();
    });
  });
});
