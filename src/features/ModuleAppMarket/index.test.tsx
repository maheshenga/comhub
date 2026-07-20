import { ConfigProvider } from '@lobehub/ui';
import { fireEvent, render, screen, within } from '@testing-library/react';
import * as m from 'motion/react-m';
import { type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ModuleAppMarket from './index';

const swrState = vi.hoisted(() => ({
  data: [] as any[] | undefined,
  error: undefined as unknown,
  isLoading: false,
  mutate: vi.fn(),
}));
const swrMock = vi.hoisted(() => vi.fn(() => swrState));

vi.mock('swr', () => ({ default: swrMock }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) =>
      key === 'moduleApps.market.viewDetailsFor'
        ? `View details for ${values?.name ?? ''}`
        : key,
  }),
}));

vi.mock('./MyAppsOverview', () => ({
  default: () => <div>my-apps-overview</div>,
}));

const renderMarket = (ui: ReactElement) => render(<ConfigProvider motion={m}>{ui}</ConfigProvider>);

describe('ModuleAppMarket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swrState.data = [];
    swrState.error = undefined;
    swrState.isLoading = false;
  });

  it.each([
    ['all', 'moduleApps.market.title'],
    ['my', 'moduleApps.my.title'],
    ['team', 'moduleApps.team.title'],
  ] as const)('uses translated heading for %s mode', (mode, key) => {
    renderMarket(<ModuleAppMarket mode={mode} />);

    expect(screen.getByRole('heading', { name: key })).toBeInTheDocument();
  });

  it('loads team apps in an explicit workspace context', () => {
    swrState.data = [
      {
        category: 'business',
        displayName: 'Team Desk',
        id: 'app-team',
        installed: true,
      },
    ];
    renderMarket(<ModuleAppMarket mode="team" workspaceId="workspace-1" />);

    expect(swrMock).toHaveBeenCalledWith(
      ['moduleApp.listTeamApps', 'workspace-1'],
      expect.any(Function),
    );
    expect(screen.getByRole('link', { name: 'View details for Team Desk' })).toHaveAttribute(
      'href',
      '/apps/app-team?workspaceId=workspace-1',
    );
  });

  it('renders a semantic skeleton while the marketplace is loading', () => {
    swrState.data = undefined;
    swrState.isLoading = true;

    renderMarket(<ModuleAppMarket />);

    expect(screen.getByRole('status', { name: 'moduleApps.market.loading' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getAllByTestId('mobile-list-skeleton-row')).toHaveLength(4);
  });

  it('renders a retryable error state', () => {
    swrState.error = new Error('offline');

    renderMarket(<ModuleAppMarket />);

    expect(screen.getByTestId('mobile-state-view')).toHaveAttribute('data-variant', 'error');
    expect(screen.getByText('moduleApps.market.loadError')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.market.retry' }));
    expect(swrState.mutate).toHaveBeenCalled();
  });

  it('renders a purpose-built empty state when no apps are published', () => {
    renderMarket(<ModuleAppMarket />);

    expect(screen.getByTestId('mobile-state-view')).toHaveAttribute('data-variant', 'empty');
    expect(screen.getByText('moduleApps.market.empty')).toBeInTheDocument();
    expect(screen.getByText('moduleApps.market.emptyDescription')).toBeInTheDocument();
  });

  it('renders published apps as semantic cards in the responsive grid', () => {
    swrState.data = [
      { category: 'business', displayName: 'Team Desk', id: 'app-team', installed: true },
      { category: 'creative', displayName: 'Studio', id: 'app-studio', installed: false },
    ];

    renderMarket(<ModuleAppMarket />);

    const grid = screen.getByTestId('module-app-market-grid');
    expect(grid).toHaveStyle({
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
    });
    expect(within(grid).getAllByRole('article')).toHaveLength(2);
    expect(within(grid).getByRole('link', { name: 'View details for Team Desk' })).toHaveAttribute(
      'href',
      '/apps/app-team',
    );
  });
});
