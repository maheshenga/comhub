import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { message } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { adminCommercialService } from '@/services/adminCommercial';

import AdminDesktopUpdatePage from './AdminDesktopUpdatePage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: vi.fn(() => ({
    data: {
      desktopDownloadLabel: 'Download',
      desktopDownloadUrl: 'https://downloads.example.com/app.exe',
      desktopLoginConfig: {},
      desktopOssConfig: {
        accessKeyId: 'external-access-key',
        accessKeySecretMasked: '****cret',
        bucket: 'external-bucket',
        endpoint: 'oss.example.com',
        path: 'releases',
      },
      desktopUpdateConfig: {
        autoCheck: true,
        channel: 'stable',
        checkInterval: 60,
        currentVersion: '1.0.0',
        releaseNotes: '',
        serverUrl: 'https://updates.example.com',
      },
    },
    isLoading: false,
  })),
}));

vi.mock('@/services/adminCommercial', () => ({
  adminCommercialService: {
    getSettingsSection: vi.fn(),
    setAppSettingsBatch: vi.fn(),
  },
}));

describe('AdminDesktopUpdatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(message, 'success').mockImplementation(() => (() => {}) as any);
    vi.mocked(adminCommercialService.setAppSettingsBatch).mockResolvedValue({ ok: true } as any);
  });

  it('renders desktop OSS fields read-only and excludes them from saves', async () => {
    render(<AdminDesktopUpdatePage />);

    expect(screen.getByLabelText('admin.desktopUpdate.ossBucket')).toBeDisabled();
    expect(screen.getByLabelText('admin.desktopUpdate.ossEndpoint')).toBeDisabled();
    expect(screen.getByLabelText('admin.desktopUpdate.ossAccessKeyId')).toBeDisabled();
    expect(screen.getByLabelText('admin.desktopUpdate.ossAccessKeySecret')).toBeDisabled();
    expect(screen.getByLabelText('admin.desktopUpdate.ossPath')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('admin.desktopUpdate.serverUrl'), {
      target: { value: 'https://new-updates.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'admin.desktopUpdate.save' }));

    await waitFor(() => {
      expect(adminCommercialService.setAppSettingsBatch).toHaveBeenCalledWith({
        updates: [
          {
            key: 'desktop.update.serverUrl',
            value: 'https://new-updates.example.com',
          },
        ],
      });
    });
  });
});
