import { ConfigProvider } from '@lobehub/ui';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as m from 'motion/react-m';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { adminCommercialService } from '@/services/adminCommercial';

import AdminModelDefaultsPage from './AdminModelDefaultsPage';

const userState = vi.hoisted(() => ({ role: 'system_admin' }));

const settingsData = vi.hoisted(() => ({
  modelDefaults: {
    contextWindow: [{ modelId: 'chat-model', providerId: 'instance-chat', tokens: 131_072 }],
    reasoning: [
      {
        config: { reasoningEffort: 'high' },
        modelId: 'chat-model',
        providerId: 'instance-chat',
      },
    ],
  },
  section: 'model-defaults',
  sharedHealth: {
    enabledNewapiModels: [
      {
        displayName: 'Chat Model',
        extendParams: ['reasoningEffort'],
        instanceName: 'Chat Instance',
        modelId: 'chat-model',
        modelType: 'chat',
        provider: 'instance-chat',
        providerType: 'newapi',
      },
      {
        displayName: 'Embedding Model',
        instanceName: 'Embedding Instance',
        modelId: 'embedding-model',
        modelType: 'embedding',
        provider: 'instance-embedding',
        providerType: 'newapi',
      },
      {
        displayName: 'Image Model',
        instanceName: 'Image Instance',
        modelId: 'image-model',
        modelType: 'image',
        provider: 'instance-image',
        providerType: 'newapi',
      },
    ],
  },
}));

const refresh = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('@/libs/swr', () => ({
  mutate: vi.fn(),
  useClientDataSWR: vi.fn(() => ({
    data: settingsData,
    error: undefined,
    isLoading: false,
    mutate: refresh,
  })),
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: { user: { role: string } }) => unknown) =>
    selector({ user: { role: userState.role } }),
}));

vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: {
    userProfile: (state: { user: unknown }) => state.user,
  },
}));

vi.mock('@/services/adminCommercial', () => {
  class MockAdminSettingsRevisionConflictError extends Error {
    details = { isConflict: true, sections: ['model-defaults'] };
  }

  return {
    AdminSettingsRevisionConflictError: MockAdminSettingsRevisionConflictError,
    getAdminSettingsSaveErrorDetails: vi.fn(() => ({ isConflict: false })),
    adminCommercialService: {
      getSettingsSection: vi.fn(),
      setAppSettingsBatch: vi.fn(),
    },
  };
});

const renderPage = () =>
  render(
    <ConfigProvider motion={m}>
      <AdminModelDefaultsPage />
    </ConfigProvider>,
  );

describe('AdminModelDefaultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userState.role = 'system_admin';
    vi.mocked(adminCommercialService.setAppSettingsBatch).mockResolvedValue({} as any);
  });

  it('renders chat and embedding models with their current defaults', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: '模型默认参数' })).toBeInTheDocument();
    expect(screen.getByText('Chat Model')).toBeInTheDocument();
    expect(screen.getByText('Embedding Model')).toBeInTheDocument();
    expect(screen.queryByText('Image Model')).not.toBeInTheDocument();
    expect(screen.getByText('128K')).toBeInTheDocument();
    expect(screen.getByText('reasoningEffort: high')).toBeInTheDocument();
  });

  it('saves the edited defaults through setAppSettingsBatch', async () => {
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: '编辑' })[0]);

    const dialog = await screen.findByRole('dialog');
    const toggle = within(dialog).getByRole('switch', { name: '设置平台默认' });
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());

    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(adminCommercialService.setAppSettingsBatch).toHaveBeenCalledWith({
        updates: [
          {
            key: 'model.defaults',
            value: {
              contextWindow: [],
              reasoning: [
                {
                  config: { reasoningEffort: 'high' },
                  modelId: 'chat-model',
                  providerId: 'instance-chat',
                },
              ],
            },
          },
        ],
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());

    await act(async () => {
      await Promise.resolve();
    });
  });

  it('is read-only when the role lacks systemWrite', () => {
    userState.role = 'finance_admin';

    renderPage();

    expect(screen.getByText('当前角色仅有只读权限，无法修改模型默认参数。')).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: '编辑' })) {
      expect(button).toBeDisabled();
    }
  });
});
