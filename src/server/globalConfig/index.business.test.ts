import type * as BusinessConst from '@lobechat/business-const';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerGlobalConfig } from './index';

const mocks = vi.hoisted(() => ({
  genServerAiProvidersConfig: vi.fn(),
  getServerDefaultAgentSettingOverrides: vi.fn(),
  getAllEnabledModels: vi.fn(),
  parseAgentConfig: vi.fn(),
  parseSSOProviders: vi.fn(),
  parseSystemAgent: vi.fn(),
}));

vi.mock('@lobechat/business-const', async (importOriginal) => {
  const actual = await importOriginal<typeof BusinessConst>();

  return {
    ...actual,
    BRANDING_PROVIDER: 'newapi',
    ENABLE_BUSINESS_FEATURES: true,
  };
});

vi.mock('@/config/klavis', () => ({
  klavisEnv: { KLAVIS_API_KEY: '' },
}));

vi.mock('@/const/version', () => ({
  isDesktop: false,
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    AGENT_GATEWAY_URL: '',
    MARKET_TRUSTED_CLIENT_ID: '',
    MARKET_TRUSTED_CLIENT_SECRET: '',
    SYSTEM_AGENT: '',
    enableQueueAgentRuntime: false,
  },
  getAppConfig: vi.fn(() => ({
    DEFAULT_AGENT_CONFIG: 'test-agent-config',
  })),
}));

vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_DISABLE_EMAIL_PASSWORD: false,
    AUTH_EMAIL_VERIFICATION: false,
    AUTH_ENABLE_MAGIC_LINK: false,
    AUTH_SSO_PROVIDERS: '',
  },
}));

vi.mock('@/envs/file', () => ({
  fileEnv: {
    S3_SECRET_ACCESS_KEY: '',
  },
}));

vi.mock('@/envs/knowledge', () => ({
  knowledgeEnv: {
    DEFAULT_FILES_CONFIG: '',
  },
}));

vi.mock('@/envs/langfuse', () => ({
  langfuseEnv: {
    ENABLE_LANGFUSE: false,
  },
}));

vi.mock('@/envs/image', () => ({
  imageEnv: {
    AI_IMAGE_DEFAULT_IMAGE_NUM: 1,
  },
}));

vi.mock('@/libs/better-auth/utils/server', () => ({
  parseSSOProviders: mocks.parseSSOProviders,
}));

vi.mock('@/server/globalConfig/parseSystemAgent', () => ({
  parseSystemAgent: mocks.parseSystemAgent,
}));

vi.mock('@/server/services/appSettings', () => ({
  getServerDefaultAgentSettingOverrides: mocks.getServerDefaultAgentSettingOverrides,
}));

vi.mock('@/server/services/newapiInstance', () => ({
  getAllEnabledModels: mocks.getAllEnabledModels,
}));

vi.mock('./genServerAiProviderConfig', () => ({
  genServerAiProvidersConfig: mocks.genServerAiProvidersConfig,
}));

vi.mock('./parseDefaultAgent', () => ({
  parseAgentConfig: mocks.parseAgentConfig,
}));

vi.mock('./parseFilesConfig', () => ({
  parseFilesConfig: vi.fn(() => ({})),
}));

vi.mock('./parseMemoryExtractionConfig', () => ({
  getPublicMemoryExtractionConfig: vi.fn(() => undefined),
}));

describe('getServerGlobalConfig business newapi model injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.genServerAiProvidersConfig.mockResolvedValue({
      newapi: {
        enabled: true,
        enabledModels: undefined,
        serverModelLists: [],
      },
      openai: {
        enabled: true,
        enabledModels: ['gpt-4o'],
        serverModelLists: [{ id: 'gpt-4o', type: 'chat' }],
      },
    });
    mocks.getServerDefaultAgentSettingOverrides.mockResolvedValue({});
    mocks.getAllEnabledModels.mockResolvedValue([]);
    mocks.parseAgentConfig.mockReturnValue({});
    mocks.parseSSOProviders.mockReturnValue([]);
    mocks.parseSystemAgent.mockReturnValue(undefined);
  });

  it('injects global newapi model IDs with all types into server provider config', async () => {
    mocks.getAllEnabledModels.mockResolvedValue([
      { id: 'gpt-4o-mini', type: 'chat', displayName: null },
      { id: 'dall-e-3', type: 'image', displayName: 'DALL-E 3' },
      { id: 'tts-1', type: 'tts', displayName: null },
    ]);

    const result = await getServerGlobalConfig({} as any);

    expect(result.aiProvider.newapi!.enabledModels).toEqual(['gpt-4o-mini', 'dall-e-3', 'tts-1']);
    expect(result.aiProvider.newapi!.serverModelLists).toEqual([
      {
        displayName: 'gpt-4o-mini',
        enabled: true,
        id: 'gpt-4o-mini',
        type: 'chat',
      },
      {
        displayName: 'DALL-E 3',
        enabled: true,
        id: 'dall-e-3',
        type: 'image',
      },
      {
        displayName: 'tts-1',
        enabled: true,
        id: 'tts-1',
        type: 'tts',
      },
    ]);
  });

  it('uses only enabled NewAPI instance models for provider injection', async () => {
    mocks.getAllEnabledModels.mockResolvedValue([
      { id: 'gpt-4o-mini', type: 'chat', displayName: null },
    ]);

    const result = await getServerGlobalConfig({} as any);

    expect(result.aiProvider.newapi!.enabledModels).toEqual(['gpt-4o-mini']);
    expect(result.aiProvider.newapi!.serverModelLists).toEqual([
      { displayName: 'gpt-4o-mini', enabled: true, id: 'gpt-4o-mini', type: 'chat' },
    ]);
  });

  it('keeps the generated provider config unchanged when no global newapi model IDs are configured', async () => {
    const result = await getServerGlobalConfig({} as any);

    expect(result.aiProvider.newapi!.enabledModels).toBeUndefined();
    expect(result.aiProvider.newapi!.serverModelLists).toEqual([]);
    expect(result.aiProvider.openai!.serverModelLists).toEqual([{ id: 'gpt-4o', type: 'chat' }]);
  });

  it('merges backend default provider and model overrides into default agent config', async () => {
    mocks.parseAgentConfig.mockReturnValue({ model: 'env-model', provider: 'openai' });
    mocks.getServerDefaultAgentSettingOverrides.mockResolvedValue({
      model: 'deepseek-chat',
      provider: 'newapi',
    });

    const result = await getServerGlobalConfig({} as any);

    expect(result.defaultAgent?.config).toMatchObject({
      model: 'deepseek-chat',
      provider: 'newapi',
    });
  });
});
