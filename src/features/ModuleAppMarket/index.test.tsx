import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ModuleAppMarket from './index';

const swrMock = vi.hoisted(() =>
  vi.fn((key: unknown) => ({
    data:
      Array.isArray(key) && key[0] === 'moduleApp.listTeamApps'
        ? [
            {
              category: 'business',
              displayName: 'Team Desk',
              id: 'app-team',
              installed: true,
            },
          ]
        : [],
    isLoading: false,
  })),
);

vi.mock('swr', () => ({ default: swrMock }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./MyAppsOverview', () => ({
  default: () => <div>my-apps-overview</div>,
}));

describe('ModuleAppMarket', () => {
  it.each([
    ['all', 'moduleApps.market.title'],
    ['my', 'moduleApps.my.title'],
    ['team', 'moduleApps.team.title'],
  ] as const)('uses translated heading for %s mode', (mode, key) => {
    render(<ModuleAppMarket mode={mode} />);

    expect(screen.getByRole('heading', { name: key })).toBeInTheDocument();
  });

  it('loads team apps in an explicit workspace context', () => {
    render(<ModuleAppMarket mode="team" workspaceId="workspace-1" />);

    expect(swrMock).toHaveBeenCalledWith(
      ['moduleApp.listTeamApps', 'workspace-1'],
      expect.any(Function),
    );
    expect(screen.getByRole('link', { name: 'moduleApps.market.viewDetails' })).toHaveAttribute(
      'href',
      '/apps/app-team?workspaceId=workspace-1',
    );
  });
});
