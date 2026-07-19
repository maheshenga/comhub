import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MOBILE_CONFIG, normalizeMobileConfig } from '@/const/mobileConfig';

import MobileWorkspaceShell, { MOBILE_WORKSPACE_CLEARANCE_VAR } from './MobileWorkspaceShell';
import { useMobileConfig } from './useMobileConfig';

vi.mock('@/business/client/hooks/useActiveWorkspaceSlug', () => ({
  useActiveWorkspaceSlug: () => null,
}));
vi.mock('./MobileTabBar', () => ({ default: () => <nav aria-label="tabs" /> }));
vi.mock('./useMobileConfig', () => ({ useMobileConfig: vi.fn() }));

describe('MobileWorkspaceShell', () => {
  beforeEach(() => {
    vi.mocked(useMobileConfig).mockReturnValue({
      config: normalizeMobileConfig({
        ...DEFAULT_MOBILE_CONFIG,
        navigation: {
          items: DEFAULT_MOBILE_CONFIG.navigation.items.map((item) =>
            item.id === 'slot-2' ? { ...item, path: '/tasks' } : item,
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

  it('owns bottom clearance for configured legacy destinations', () => {
    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <MobileWorkspaceShell>
          <div>Tasks</div>
        </MobileWorkspaceShell>
      </MemoryRouter>,
    );

    const shell = screen.getByTestId('mobile-workspace-shell');
    expect(shell).toHaveAttribute('data-tab-bar-visible', 'true');
    expect(shell.style.getPropertyValue(MOBILE_WORKSPACE_CLEARANCE_VAR)).toContain(
      'env(safe-area-inset-bottom)',
    );
  });

  it('removes bottom clearance on deep destinations', () => {
    render(
      <MemoryRouter initialEntries={['/tasks/detail']}>
        <MobileWorkspaceShell>
          <div>Task detail</div>
        </MobileWorkspaceShell>
      </MemoryRouter>,
    );

    const shell = screen.getByTestId('mobile-workspace-shell');
    expect(shell).toHaveAttribute('data-tab-bar-visible', 'false');
    expect(shell.style.getPropertyValue(MOBILE_WORKSPACE_CLEARANCE_VAR)).toBe('0px');
  });
});
