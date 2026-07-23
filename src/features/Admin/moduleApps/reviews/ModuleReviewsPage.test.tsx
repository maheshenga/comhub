import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const moduleApps = vi.hoisted(() => ({
  approvePackage: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  listPackages: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  rejectPackage: vi.fn(),
  rescanPackage: vi.fn(),
}));
const state = vi.hoisted(() => ({
  data: { items: [], nextCursor: null } as { items: any[]; nextCursor: null | string },
}));

vi.mock('@/services/adminCommercial', () => ({ adminCommercialService: { moduleApps } }));
vi.mock('@/libs/swr', () => ({
  mutate: vi.fn(),
  useClientDataSWR: (_key: unknown, fetcher: () => Promise<unknown>) => {
    void fetcher();
    return { data: state.data, error: undefined, isLoading: false };
  },
}));
vi.mock('@lobehub/ui/base-ui', () => ({
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Modal: ({ children, okButtonProps, okText, onOk, open }: any) =>
    open ? (
      <div>
        {children}
        <button disabled={okButtonProps?.disabled} type="button" onClick={onOk}>
          {okText}
        </button>
      </div>
    ) : null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import ModuleReviewsPage from './ModuleReviewsPage';

describe('ModuleReviewsPage', () => {
  it('uses only package data and restores review filters and cursor from the URL', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/settings/admin/modules/reviews?reviewStatus=rejected&buildStatus=failed&appId=app-1&publisherId=publisher-1&submittedByUserId=user-1&cursor=cursor-1',
        ]}
      >
        <ModuleReviewsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(moduleApps.listPackages).toHaveBeenCalledWith({
        appId: 'app-1',
        buildStatus: 'failed',
        cursor: 'cursor-1',
        limit: 25,
        publisherId: 'publisher-1',
        reviewStatus: 'rejected',
        submittedByUserId: 'user-1',
      }),
    );
    expect(moduleApps.get).not.toHaveBeenCalled();
    expect(moduleApps.list).not.toHaveBeenCalled();
    expect(screen.getByTestId('module-reviews-page')).toBeInTheDocument();
  });

  it('requires a rejection reason before rejecting a pending package', async () => {
    state.data = {
      items: [
        {
          buildStatus: 'ready',
          id: 'package-1',
          manifestSnapshot: { app: { displayName: 'Review target' }, packageVersion: '1.0.0' },
          reviewStatus: 'pending_review',
          scanStatus: 'clean',
          submittedByUserId: 'user-1',
        },
      ],
      nextCursor: null,
    };

    render(
      <MemoryRouter initialEntries={['/settings/admin/modules/reviews']}>
        <ModuleReviewsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.admin.reviews.reject' }));
    expect(screen.getByLabelText('moduleApps.admin.reviews.rejectReason')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'moduleApps.admin.reviews.confirmRejection' }),
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText('moduleApps.admin.reviews.rejectReason'), {
      target: { value: 'Manifest fails policy.' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'moduleApps.admin.reviews.confirmRejection' }),
    );

    await waitFor(() =>
      expect(moduleApps.rejectPackage).toHaveBeenCalledWith({
        packageId: 'package-1',
        reason: 'Manifest fails policy.',
      }),
    );
  });
});
