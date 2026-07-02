import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import NavPanelUpgradeEntry from './NavPanelUpgradeEntry';

vi.mock('@/features/Brand', () => ({
  useBrand: () => ({
    sidebarMemberDescription: '解锁更多容量与高级功能。',
    sidebarMemberLabel: '升级方案',
    sidebarMemberUrl: '/settings/plans',
  }),
}));

vi.mock('@/features/Workspace/WorkspaceLink', () => ({
  default: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Icon: () => <span aria-hidden="true" />,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    arrow: 'arrow',
    card: 'card',
    description: 'description',
    icon: 'icon',
    title: 'title',
  }),
  cssVar: {
    colorBgContainer: '#fff',
    colorBorderSecondary: '#eee',
    colorFillTertiary: '#f5f5f5',
    colorText: '#000',
    colorTextSecondary: '#666',
  },
}));

describe('NavPanelUpgradeEntry', () => {
  it('renders the configured upgrade prompt', () => {
    render(<NavPanelUpgradeEntry />);

    expect(screen.getByRole('link', { name: /升级方案/ })).toHaveAttribute(
      'href',
      '/settings/plans',
    );
    expect(screen.getByText('解锁更多容量与高级功能。')).toBeInTheDocument();
  });
});
