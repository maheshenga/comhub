import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ModuleAppFinancePage from './FinancePage';

const swrState = vi.hoisted(() => ({ keys: [] as unknown[][] }));

vi.mock('@/libs/swr', () => ({
  mutate: vi.fn().mockResolvedValue(undefined),
  useClientDataSWR: vi.fn((key: unknown[]) => {
    if (key) swrState.keys.push(key);
    return { data: { items: [], nextCursor: null }, isLoading: false };
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'moduleApps.admin.finance.description':
          'Review Module App revenue, payments, publishers, and payouts.',
        'moduleApps.admin.finance.refresh': 'Refresh',
        'moduleApps.admin.finance.tabs.payments': 'Payments',
        'moduleApps.admin.finance.tabs.payouts': 'Payouts',
        'moduleApps.admin.finance.tabs.publishers': 'Publishers',
        'moduleApps.admin.finance.tabs.revenue': 'Revenue',
        'moduleApps.admin.finance.title': 'Module App finance',
      })[key] ?? key,
  }),
}));

describe('ModuleAppFinancePage', () => {
  beforeEach(() => {
    swrState.keys = [];
  });

  it('registers only finance-owned data requests', () => {
    render(<ModuleAppFinancePage />);

    expect(Array.from(new Set(swrState.keys.map((key) => key[0])))).toEqual([
      'admin-module-app-revenue',
      'admin-module-app-publishers',
      'admin-module-app-payouts',
      'admin-module-app-payments',
    ]);
  });

  it('renders finance tabs without governance controls', () => {
    render(<ModuleAppFinancePage />);

    for (const tab of ['Revenue', 'Payments', 'Publishers', 'Payouts']) {
      expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument();
    }
    expect(screen.queryByText('Package review')).not.toBeInTheDocument();
    expect(screen.queryByText('Pages')).not.toBeInTheDocument();
    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    expect(screen.queryByText('Products')).not.toBeInTheDocument();
    expect(screen.queryByText('Runs')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});
