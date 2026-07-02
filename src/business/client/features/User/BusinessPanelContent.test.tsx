import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BusinessPanelContent, { BusinessPlanBadge } from './BusinessPanelContent';

const mocks = vi.hoisted(() => ({
  profile: {
    accountSummary: {
      balance: 500_000,
      breakdown: {
        other: { available: 0, consumed: 0, credited: 0 },
        referral: { available: 0, consumed: 0, credited: 0 },
        subscription: { available: 125_000, consumed: 375_000, credited: 500_000 },
        topup: { available: 0, consumed: 0, credited: 0 },
      },
      currency: 'credits',
      totalCredited: 500_000,
      totalDebited: 375_000,
    },
    currentPlan: 'free',
    subscriptionSummary: {
      currency: 'USD',
      cycle: 'monthly',
      isFreePlan: true,
      monthlyCredits: 500_000,
      monthlyPrice: 0,
      plan: 'free',
      status: 'active',
    },
  },
}));

vi.mock('@/business/client/BusinessSettingPages/shared', () => ({
  formatCredits: (value: number) => `${value / 1_000_000}M`,
  useBusinessSubscriptionProfile: () => mocks.profile,
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    creditRow: 'creditRow',
    planBadge: 'planBadge',
  }),
  cssVar: {
    colorFillTertiary: '#f5f5f5',
    colorTextSecondary: '#666',
  },
}));

vi.mock('@/features/Workspace/WorkspaceLink', () => ({
  default: ({
    children,
    className,
    to,
  }: {
    children?: React.ReactNode;
    className?: string;
    to: string;
  }) => (
    <a className={className} href={to}>
      {children}
    </a>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      ({
        'credits.account.breakdown.subscription': '免费积分',
        'plans.plan.free.title': '免费版',
      })[key] ??
      fallback ??
      key,
  }),
}));

describe('BusinessPanelContent', () => {
  it('shows the current plan badge', () => {
    render(<BusinessPlanBadge />);

    expect(screen.getByRole('link', { name: '免费版' })).toHaveAttribute(
      'href',
      '/settings/plans',
    );
  });

  it('shows subscription credit usage', () => {
    render(<BusinessPanelContent />);

    expect(screen.getByText('免费积分')).toBeInTheDocument();
    expect(screen.getByText('0.125M / 0.5M')).toBeInTheDocument();
  });
});
