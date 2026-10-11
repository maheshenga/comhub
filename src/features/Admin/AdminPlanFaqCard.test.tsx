import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import AdminPlanFaqCard from './AdminPlanFaqCard';

const swrState = vi.hoisted(() => ({
  data: undefined as Record<string, unknown> | undefined,
  error: undefined as Error | undefined,
  isLoading: false,
  mutate: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrValues?: string | Record<string, unknown>) =>
      typeof fallbackOrValues === 'string' ? fallbackOrValues : key,
  }),
}));

vi.mock('@/libs/swr', () => ({
  mutate: vi.fn(),
  useClientDataSWR: vi.fn(() => swrState),
}));

vi.mock('@/services/adminCommercial', () => ({
  adminCommercialService: {
    getSettingsSection: vi.fn(),
    setAppSettingsBatch: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/components/antd-compat/Card', () => ({
  Card: ({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) => (
    <section>
      {extra}
      {children}
    </section>
  ),
}));

vi.mock('@/features/Admin/shared/AdminPageState', () => ({
  AdminPageError: ({ description }: { description?: string }) => <div>error:{description}</div>,
}));

const FAQ_ITEMS = [
  { id: 'faq-1', question: '如何退款？', answer: '联系客服处理。', enabled: true },
];

describe('AdminPlanFaqCard', () => {
  beforeEach(() => {
    swrState.data = undefined;
    swrState.error = undefined;
    swrState.isLoading = false;
    vi.mocked(mutate).mockClear();
    vi.mocked(useClientDataSWR).mockClear();
    vi.mocked(adminCommercialService.setAppSettingsBatch).mockClear();
  });

  it('renders the load-failure state and hides the save entry when there is no data', async () => {
    swrState.error = new Error('offline');
    swrState.isLoading = false;

    render(<AdminPlanFaqCard />);

    await waitFor(() => {
      expect(screen.getByText(/error:/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /保存常见问题/ })).toBeNull();
  });

  it('blocks saving when SWR settles with no data and no error', async () => {
    // The dangerous state is not "request failed" but "we never obtained server
    // data": the form renders empty, validateFields resolves with undefined, and
    // normalizePlanFaqSettings(undefined) returns DEFAULT_PLAN_FAQ_ITEMS — one
    // click wipes the real config. SWR reaches this via an empty settle, so the
    // guard keys on hasServerData, not on `error`.
    swrState.error = undefined;
    swrState.data = undefined;
    swrState.isLoading = false;

    render(<AdminPlanFaqCard />);

    await waitFor(() => {
      expect(screen.getByText(/error:/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /保存常见问题/ })).toBeNull();
    expect(document.querySelector('form')).toBeNull();
    expect(
      adminCommercialService.setAppSettingsBatch as unknown as ReturnType<typeof vi.fn>,
    ).not.toHaveBeenCalled();
  });

  it('keeps the save entry when a revalidate fails but cached data exists', async () => {
    swrState.error = new Error('stale');
    swrState.data = { plansFaqItems: FAQ_ITEMS };

    render(<AdminPlanFaqCard />);

    await waitFor(() => {
      expect(screen.getByText(/刷新失败/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /保存常见问题/ })).toBeInTheDocument();
    expect(screen.queryByText(/error:/)).toBeNull();
  });
});
