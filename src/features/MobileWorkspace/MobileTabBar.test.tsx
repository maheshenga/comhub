import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MOBILE_CONFIG, normalizeMobileConfig } from '@/const/mobileConfig';

import MobileTabBar from './MobileTabBar';
import { useMobileConfig } from './useMobileConfig';

const navigate = vi.fn();
const workspaceState = vi.hoisted(() => ({ slug: 'acme' as string | null }));

vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => navigate,
}));
vi.mock('@/business/client/hooks/useActiveWorkspaceSlug', () => ({
  useActiveWorkspaceSlug: () => workspaceState.slug,
}));

vi.mock('./useMobileConfig', () => ({
  useMobileConfig: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === 'mobile.navigation.ariaLabel' ? 'Mobile workspace navigation' : key,
  }),
}));

vi.mock('@lobehub/ui', () => ({ Icon: () => <span aria-hidden="true" /> }));

describe('MobileTabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceState.slug = 'acme';
    vi.mocked(useMobileConfig).mockReturnValue({
      config: normalizeMobileConfig({
        ...DEFAULT_MOBILE_CONFIG,
        navigation: {
          items: DEFAULT_MOBILE_CONFIG.navigation.items.map((item) =>
            item.id === 'slot-2'
              ? { ...item, label: 'Create', order: 4 }
              : item.id === 'slot-4'
                ? { ...item, label: 'Tools', order: 2 }
                : item,
          ),
        },
      }),
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      revision: 0,
      updatedAt: '1970-01-01T00:00:00.000Z',
    });
  });

  it('renders configured visible tabs in order and marks the active stable slot', () => {
    render(
      <MemoryRouter initialEntries={['/discover']}>
        <MobileTabBar />
      </MemoryRouter>,
    );

    const tabBar = screen.getByRole('navigation', { name: 'Mobile workspace navigation' });
    expect(tabBar).toHaveAttribute('data-active-key', 'slot-3');
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '最近',
      'Tools',
      '发现',
      'Create',
    ]);
    expect(screen.getByRole('button', { name: '发现' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Tools' })).not.toHaveAttribute('aria-current');
  });

  it('keeps workspace tabs scoped while global discovery escapes the workspace', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileTabBar />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Tools' }));
    expect(navigate).toHaveBeenCalledWith('/apps');

    await user.click(screen.getByRole('button', { name: '发现' }));
    expect(navigate).toHaveBeenCalledWith('/discover', { escape: true });
  });

  it('does not render on deep pages', () => {
    render(
      <MemoryRouter initialEntries={['/agent/a/topic']}>
        <MobileTabBar />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole('navigation', { name: 'Mobile workspace navigation' }),
    ).not.toBeInTheDocument();
  });
});
