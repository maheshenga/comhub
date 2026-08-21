import { ConfigProvider } from '@lobehub/ui';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as m from 'motion/react-m';
import { describe, expect, it, vi } from 'vitest';

import {
  adminCommercialService,
  AdminSettingsRevisionConflictError,
} from '@/services/adminCommercial';

import AdminDefaultSettingsPage from './AdminDefaultSettingsPage';

const runtimeSettings = vi.hoisted(() => ({
  memoryExtractionConfig: {
    embeddingModel: 'embedding-model',
    embeddingProvider: 'embedding-provider',
    gatekeeperModel: 'chat-model',
    gatekeeperProvider: 'chat-provider',
    layerExtractorModel: 'chat-model',
    layerExtractorProvider: 'chat-provider',
    personaWriterModel: 'chat-model',
    personaWriterProvider: 'chat-provider',
  },
  sharedHealth: {
    enabledNewapiModels: [
      {
        displayName: 'Chat Model',
        instanceName: 'Chat Instance',
        modelId: 'chat-model',
        modelType: 'chat',
        provider: 'chat-provider',
        providerType: 'newapi',
      },
      {
        displayName: 'Embedding Model',
        instanceName: 'Embedding Instance',
        modelId: 'embedding-model',
        modelType: 'embedding',
        provider: 'embedding-provider',
        providerType: 'newapi',
      },
    ],
  },
  vectorConfig: {
    embeddingModel: 'embedding-model',
    embeddingProvider: 'embedding-provider',
    queryMode: 'hybrid',
    rerankerModel: 'chat-model',
    rerankerProvider: 'chat-provider',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('@/libs/swr', () => ({
  mutate: vi.fn(),
  useClientDataSWR: vi.fn(() => ({
    data: runtimeSettings,
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  })),
}));

vi.mock('@/services/adminCommercial', () => {
  class MockAdminSettingsRevisionConflictError extends Error {
    details: { isConflict: true; sections: string[] };

    constructor() {
      super('APP_SETTINGS_REVISION_CONFLICT');
      this.name = 'AdminSettingsRevisionConflictError';
      this.details = { isConflict: true, sections: ['ai-runtime-defaults'] };
    }
  }

  return {
    AdminSettingsRevisionConflictError: MockAdminSettingsRevisionConflictError,
    adminCommercialService: {
      getSettingsSection: vi.fn(),
      refreshRuntimeCaches: vi.fn(),
      setAppSettingsBatch: vi.fn(),
    },
  };
});

const runtimePairs = [
  {
    group: 'Embedding 模型与Embedding 供应商',
    provider: 'Embedding 供应商',
    value: 'newapi / Embedding Instance',
  },
  {
    group: 'Reranker 模型与Reranker 供应商',
    provider: 'Reranker 供应商',
    value: 'newapi / Chat Instance',
  },
  {
    group: '记忆判定模型与记忆判定供应商',
    provider: '记忆判定供应商',
    value: 'newapi / Chat Instance',
  },
  {
    group: '分层提取模型与分层提取供应商',
    provider: '分层提取供应商',
    value: 'newapi / Chat Instance',
  },
  {
    group: '用户画像写入模型与用户画像供应商',
    provider: '用户画像供应商',
    value: 'newapi / Chat Instance',
  },
  {
    group: '记忆 Embedding 模型与记忆 Embedding 供应商',
    provider: '记忆 Embedding 供应商',
    value: 'newapi / Embedding Instance',
  },
];

describe('AdminDefaultSettingsPage runtime models', () => {
  it('renders six catalog-backed pairs with resolved read-only providers', async () => {
    render(
      <ConfigProvider motion={m}>
        <AdminDefaultSettingsPage scope="ai-runtime-defaults" />
      </ConfigProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'AI 运行时默认值' })).toBeInTheDocument();

    for (const pair of runtimePairs) {
      const group = screen.getByRole('group', { name: pair.group });
      const provider = within(group).getByLabelText(pair.provider);

      expect(provider).toHaveAttribute('readonly');
      await waitFor(() => expect(provider).toHaveValue(pair.value));
    }
  });

  it('renders a revision conflict alert instead of hiding the save cause', async () => {
    vi.mocked(adminCommercialService.setAppSettingsBatch).mockRejectedValueOnce(
      new AdminSettingsRevisionConflictError({
        isConflict: true,
        sections: ['ai-runtime-defaults'],
      }),
    );

    render(
      <ConfigProvider motion={m}>
        <AdminDefaultSettingsPage scope="ai-runtime-defaults" />
      </ConfigProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '保存设置' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }));

    await waitFor(() =>
      expect(screen.getByText(/APP_SETTINGS_REVISION_CONFLICT/)).toBeInTheDocument(),
    );
  });
});
