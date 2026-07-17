import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { adminCommercialService } from '@/services/adminCommercial';

import AdminSystemMaintenancePage from './AdminSystemMaintenancePage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./AdminDangerousActionButton', () => ({
  default: ({
    children,
    onConfirm,
  }: {
    children?: ReactNode;
    onConfirm: (command: {
      actionId: 'setting.runMaintenance';
      confirmed: true;
    }) => Promise<void> | void;
  }) => (
    <button
      onClick={() =>
        void onConfirm({ actionId: 'setting.runMaintenance', confirmed: true })
      }
    >
      {children}
    </button>
  ),
}));

vi.mock('@/libs/swr', () => ({
  mutate: vi.fn(),
  useClientDataSWR: vi.fn(() => ({
    data: {
      cronAuditRetentionDays: 365,
      cronPendingOrderExpiryDays: 7,
      notificationRetentionDays: 90,
    },
    isLoading: false,
  })),
}));

vi.mock('@/services/adminCommercial', () => ({
  adminCommercialService: {
    getAllSettings: vi.fn(),
    refreshRuntimeCaches: vi.fn(),
    runMaintenance: vi.fn(),
    setAppSettingsBatch: vi.fn(),
  },
}));

describe('AdminSystemMaintenancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminCommercialService.runMaintenance).mockResolvedValue({
      moduleAppUploadCleanupFailed: 1,
      moduleAppUploadsExpired: 2,
      ok: true,
    } as any);
  });

  it('shows module app cleanup counts in the maintenance result', async () => {
    render(<AdminSystemMaintenancePage />);

    fireEvent.click(screen.getByRole('button', { name: 'admin.maintenance.runNow' }));

    await waitFor(() => {
      expect(adminCommercialService.runMaintenance).toHaveBeenCalledWith({
        actionId: 'setting.runMaintenance',
        confirmed: true,
      });
    });
    expect(await screen.findByText('已清理模块应用上传：2')).toBeInTheDocument();
    expect(screen.getByText('模块应用上传清理失败：1')).toBeInTheDocument();
  });
});
