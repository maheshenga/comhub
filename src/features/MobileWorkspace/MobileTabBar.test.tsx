import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MOBILE_CONFIG, normalizeMobileConfig } from '@/const/mobileConfig';

import MobileTabBar from './MobileTabBar';
import { useMobileConfig } from './useMobileConfig';

const navigate = vi.fn();

vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => navigate,
}));

vi.mock('./useMobileConfig', () => ({
  useMobileConfig: vi.fn(),
}));

vi.mock('@lobehub/ui/mobile', () => ({
  TabBar: ({ activeKey, height, items }: any) => (
    <nav aria-label="Mobile workspace" data-active-key={activeKey} data-height={height}>
      {items.map((item: any) => (
        <button key={item.key} type="button" onClick={item.onClick}>
          {item.icon?.(item.key === activeKey)}
          {item.title}
        </button>
      ))}
    </nav>
  ),
}));

describe('MobileTabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      mutate: vi.fn(),
    });
  });

  it('renders configured visible tabs in order and marks the active stable slot', () => {
    render(
      <MemoryRouter initialEntries={['/discover']}>
        <MobileTabBar />
      </MemoryRouter>,
    );

    const tabBar = screen.getByRole('navigation', { name: 'Mobile workspace' });
    expect(tabBar).toHaveAttribute('data-active-key', 'slot-3');
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '最近',
      'Tools',
      '发现',
      'Create',
    ]);
  });

  it('uses workspace-aware escaped navigation for reserved mobile roots', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileTabBar />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Tools' }));
    expect(navigate).toHaveBeenCalledWith('/apps', { escape: true });
  });

  it('does not render on deep pages', () => {
    render(
      <MemoryRouter initialEntries={['/agent/a/topic']}>
        <MobileTabBar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('navigation', { name: 'Mobile workspace' })).not.toBeInTheDocument();
  });
});
