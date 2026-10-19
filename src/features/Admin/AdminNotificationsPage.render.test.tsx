import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import AdminNotificationsPage from './AdminNotificationsPage';
import { SETTING_KEYS } from './adminSettingsForm';

vi.mock('@/libs/swr', () => ({
  mutate: vi.fn(() => Promise.resolve()),
  useClientDataSWR: vi.fn(),
}));

vi.mock('@/services/adminCommercial', () => ({
  adminCommercialService: {
    getSettingsSection: vi.fn(),
    setAppSettingsBatch: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

const notificationData = {
  notificationDesktopEnabled: true,
  notificationEmailEnabled: false,
  notificationInboxEnabled: true,
  notificationPushEnabled: true,
  notificationRetentionDays: 90,
  notificationSystemEnabled: false,
  notificationSystemType: 'warning',
};

describe('AdminNotificationsPage FormKit integration', () => {
  beforeEach(() => {
    vi.mocked(useClientDataSWR).mockReturnValue({
      data: notificationData,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as any);
    vi.mocked(adminCommercialService.setAppSettingsBatch).mockResolvedValue({ ok: true } as any);
  });

  it('binds nested channel switches and saves only the changed root field', async () => {
    render(<AdminNotificationsPage />);

    fireEvent.click(screen.getByLabelText('启用系统公告'));
    fireEvent.click(screen.getByRole('button', { name: '保存通知配置' }));

    await waitFor(() => {
      expect(adminCommercialService.setAppSettingsBatch).toHaveBeenCalledWith({
        updates: [{ key: SETTING_KEYS.notificationSystemEnabled, value: true }],
      });
    });
  });

  it('includes the full nested event-default map when a channel event is toggled', async () => {
    render(<AdminNotificationsPage />);

    const eventSwitch = screen
      .getAllByRole('switch')
      .find((element) => element.getAttribute('aria-label')?.includes(': '));
    expect(eventSwitch).toBeDefined();
    fireEvent.click(eventSwitch!);
    fireEvent.click(screen.getByRole('button', { name: '保存通知配置' }));

    await waitFor(() => {
      expect(adminCommercialService.setAppSettingsBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          updates: expect.arrayContaining([
            expect.objectContaining({ key: SETTING_KEYS.notificationEventDefaults }),
          ]),
        }),
      );
    });
  });
});
