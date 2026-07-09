import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { adminCommercialService } from '@/services/adminCommercial';

import AdminModuleAppsPage from './index';

const PACKAGE_ID = '00000000-0000-4000-8000-000000000011';

vi.mock('@/features/Admin/moduleApps/AppEditorModal', () => ({
  default: () => null,
}));

vi.mock('@/libs/swr', () => ({
  mutate: vi.fn(),
  useClientDataSWR: vi.fn((key: unknown) => {
    if (!key) return { data: undefined, isLoading: false };

    const cacheKey = Array.isArray(key) ? key[0] : key;

    if (cacheKey === 'admin-module-apps') {
      return {
        data: {
          items: [
            {
              appType: 'standard_app',
              category: 'business',
              displayName: 'Classified Info',
              icon: 'Package',
              id: '00000000-0000-4000-8000-000000000001',
              slug: 'classified-info',
              source: 'developer',
              status: 'draft',
              tags: [],
            },
          ],
          nextCursor: null,
        },
        isLoading: false,
      };
    }

    if (cacheKey === 'admin-module-app-detail') {
      return {
        data: {
          actions: [],
          appType: 'standard_app',
          billing: { chargeMode: 'free', defaultMultiplier: 1 },
          category: 'business',
          description: 'Classified information module.',
          displayName: 'Classified Info',
          entitlements: [],
          icon: 'Package',
          id: '00000000-0000-4000-8000-000000000001',
          pages: [],
          slug: 'classified-info',
          source: 'developer',
          status: 'draft',
          tags: [],
        },
        isLoading: false,
      };
    }

    if (cacheKey === 'admin-module-app-packages') {
      return {
        data: {
          items: [
            {
              createdAt: '2026-07-10T00:00:00.000Z',
              id: PACKAGE_ID,
              manifestSnapshot: {
                app: {
                  displayName: 'Recruiting Desk',
                  slug: 'recruiting-desk',
                  source: 'developer',
                },
                packageVersion: '1.0.0',
              },
              reviewStatus: 'pending_review',
              submittedByUserId: 'developer-1',
            },
          ],
          nextCursor: null,
        },
        isLoading: false,
      };
    }

    return { data: { items: [], nextCursor: null }, isLoading: false };
  }),
}));

vi.mock('@/services/adminCommercial', () => ({
  adminCommercialService: {
    moduleApps: {
      approvePackage: vi.fn().mockResolvedValue({ ok: true }),
      get: vi.fn(),
      list: vi.fn(),
      listArtifacts: vi.fn(),
      listAuditEvents: vi.fn(),
      listInstalls: vi.fn(),
      listPackages: vi.fn(),
      listRecords: vi.fn(),
      listRuns: vi.fn(),
      publish: vi.fn(),
      rejectPackage: vi.fn().mockResolvedValue({ ok: true }),
      unpublish: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

describe('AdminModuleAppsPage package review', () => {
  it('renders package submissions and approves a pending package', async () => {
    render(<AdminModuleAppsPage />);

    expect(screen.getByText('Package review')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Package review'));

    expect(screen.getByText('Recruiting Desk')).toBeInTheDocument();
    expect(screen.getByText('pending_review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(adminCommercialService.moduleApps.approvePackage).toHaveBeenCalledWith({
        packageId: PACKAGE_ID,
      });
    });
  });
});
