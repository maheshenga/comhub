// @vitest-environment node
import type * as BusinessConst from '@lobechat/business-const';
import { OFFICIAL_PROVIDER_DISABLE_ERROR } from '@lobechat/business-const';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiProviderModel } from '@/database/models/aiProvider';
import { AiInfraRepos } from '@/database/repositories/aiInfra';
import { getServerGlobalConfig } from '@/server/globalConfig';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { type AiProviderDetailItem, type AiProviderRuntimeState } from '@/types/aiProvider';

import { aiProviderRouter } from '../aiProvider';

const planRuleMocks = vi.hoisted(() => ({
  isModelAllowedByPlanRules: vi.fn<
    (
      rules: unknown,
      modelId: string | null | undefined,
      modelType: string,
      groupKey?: string | null,
    ) => boolean
  >(() => true),
  resolvePlanModelRules: vi.fn<() => Promise<unknown>>(async () => null),
}));

const runtimeMocks = vi.hoisted(() => ({
  initModelRuntimeFromDB: vi.fn(),
}));

vi.mock('@/business/server/planModelRules', () => ({
  isModelAllowedByPlanRules: planRuleMocks.isModelAllowedByPlanRules,
  resolvePlanModelRules: planRuleMocks.resolvePlanModelRules,
}));
vi.mock('@/server/globalConfig');
vi.mock('@/server/modules/KeyVaultsEncrypt');
vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: runtimeMocks.initModelRuntimeFromDB,
}));
vi.mock('@/database/repositories/aiInfra');
vi.mock('@/database/models/aiProvider');
vi.mock('@/database/models/user');
vi.mock('@lobechat/business-const', async () => {
  const actual = await vi.importActual<typeof BusinessConst>('@lobechat/business-const');

  return {
    ...actual,
    BRANDING_PROVIDER: 'lobehub',
    ENABLE_BUSINESS_FEATURES: true,
    isOfficialProvider: (id: string) => id === 'lobehub',
  };
});

describe('aiProviderRouter', () => {
  const mockUserId = 'test-user-id';
  const mockProviderId = 'test-provider-id';
  const mockServerDB = { query: {} };
  const mockEncrypt = vi.fn();
  const mockDecrypt = vi.fn();

  const mockGateKeeper = {
    encrypt: mockEncrypt,
    decrypt: mockDecrypt,
  };

  const mockProviderDetail: AiProviderDetailItem = {
    id: mockProviderId,
    name: 'Test Provider',
    enabled: true,
    description: 'Test Description',
    source: 'custom',
    settings: {},
  };

  const mockRuntimeState: AiProviderRuntimeState = {
    enabledAiModels: [],
    enabledAiProviders: [],
    enabledChatAiProviders: [],
    enabledImageAiProviders: [],
    enabledVideoAiProviders: [],
    runtimeConfig: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getServerGlobalConfig).mockReturnValue({
      aiProvider: {},
    } as any);

    vi.mocked(KeyVaultsGateKeeper.initWithEnvKey).mockResolvedValue(mockGateKeeper as any);
  });

  const createMockContext = () => ({
    serverDB: mockServerDB,
    userId: mockUserId,
  });

  describe('checkProviderConnectivity', () => {
    it('should initialize NewAPI runtime with the selected check model for model-aware routing', async () => {
      const mockChat = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const mockGetDetail = vi.fn().mockResolvedValue({
        ...mockProviderDetail,
        checkModel: 'gpt-4o-mini',
      });
      vi.mocked(AiInfraRepos).prototype.getAiProviderDetail = mockGetDetail;
      runtimeMocks.initModelRuntimeFromDB.mockResolvedValue({ chat: mockChat });

      const caller = aiProviderRouter.createCaller(createMockContext());
      const result = await caller.checkProviderConnectivity({ id: 'newapi' });

      expect(result).toEqual({ model: 'gpt-4o-mini', ok: true });
      const resolvedDb = runtimeMocks.initModelRuntimeFromDB.mock.calls.at(-1)?.[0];
      expect(resolvedDb).toBeDefined();
      expect(runtimeMocks.initModelRuntimeFromDB).toHaveBeenCalledWith(
        resolvedDb,
        mockUserId,
        'newapi',
        {
          model: 'gpt-4o-mini',
          modelType: 'chat',
        },
      );
    });
  });

  describe('createAiProvider', () => {
    it('should create a new AI provider', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: mockProviderId });
      vi.mocked(AiProviderModel).prototype.create = mockCreate;

      const caller = aiProviderRouter.createCaller(createMockContext());
      const result = await caller.createAiProvider({
        id: mockProviderId,
        name: 'Test Provider',
        source: 'custom',
      });

      expect(result).toBe(mockProviderId);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockProviderId,
          name: 'Test Provider',
        }),
        mockGateKeeper.encrypt,
      );
    });
  });

  describe('getAiProviderById', () => {
    it('should get AI provider by id', async () => {
      const mockGetDetail = vi.fn().mockResolvedValue(mockProviderDetail);
      vi.mocked(AiInfraRepos).prototype.getAiProviderDetail = mockGetDetail;

      const caller = aiProviderRouter.createCaller(createMockContext());
      const result = await caller.getAiProviderById({ id: mockProviderId });

      expect(result).toEqual(mockProviderDetail);
      expect(mockGetDetail).toHaveBeenCalledWith(
        mockProviderId,
        KeyVaultsGateKeeper.getUserKeyVaults,
      );
    });
  });

  describe('getAiProviderList', () => {
    it('should get AI provider list', async () => {
      const mockList = [mockProviderDetail];
      const mockGetList = vi.fn().mockResolvedValue(mockList);
      vi.mocked(AiInfraRepos).prototype.getAiProviderList = mockGetList;

      const caller = aiProviderRouter.createCaller(createMockContext());
      const result = await caller.getAiProviderList();

      expect(result).toEqual(mockList);
      expect(mockGetList).toHaveBeenCalled();
    });
  });

  describe('getAiProviderRuntimeState', () => {
    it('should resolve server provider config with request database so DB-managed NewAPI models are available', async () => {
      const mockGetState = vi.fn().mockResolvedValue(mockRuntimeState);
      vi.mocked(AiInfraRepos).prototype.getAiProviderRuntimeState = mockGetState;
      vi.mocked(getServerGlobalConfig).mockResolvedValue({
        aiProvider: {
          newapi: {
            enabled: true,
            serverModelLists: [{ enabled: true, id: 'deepseek-chat', type: 'chat' }],
          },
        },
      } as any);

      const caller = aiProviderRouter.createCaller(createMockContext());
      await caller.getAiProviderRuntimeState({});

      const resolvedDb = vi.mocked(getServerGlobalConfig).mock.calls.at(-1)?.[0];
      expect(resolvedDb).toBeDefined();
      expect(AiInfraRepos).toHaveBeenCalledWith(
        resolvedDb,
        mockUserId,
        expect.objectContaining({
          newapi: expect.objectContaining({
            serverModelLists: [expect.objectContaining({ id: 'deepseek-chat' })],
          }),
        }),
      );
    });

    it('should get AI provider runtime state', async () => {
      const mockGetState = vi.fn().mockResolvedValue(mockRuntimeState);
      vi.mocked(AiInfraRepos).prototype.getAiProviderRuntimeState = mockGetState;

      const caller = aiProviderRouter.createCaller(createMockContext());
      const result = await caller.getAiProviderRuntimeState({});

      expect(result).toEqual(mockRuntimeState);
      expect(mockGetState).toHaveBeenCalledWith(KeyVaultsGateKeeper.getUserKeyVaults);
    });

    it('should filter enabled models and providers by current plan model rules', async () => {
      const state: AiProviderRuntimeState = {
        enabledAiModels: [
          { enabled: true, id: 'free-chat', providerId: 'newapi', type: 'chat' } as any,
          { enabled: true, id: 'pro-chat', providerId: 'newapi', type: 'chat' } as any,
          { enabled: true, id: 'free-image', providerId: 'newapi', type: 'image' } as any,
          { enabled: true, id: 'pro-video', providerId: 'newapi', type: 'video' } as any,
        ],
        enabledAiProviders: [{ id: 'newapi', name: 'AI Provider', source: 'builtin' }],
        enabledChatAiProviders: [{ id: 'newapi', name: 'AI Provider', source: 'builtin' }],
        enabledImageAiProviders: [{ id: 'newapi', name: 'AI Provider', source: 'builtin' }],
        enabledVideoAiProviders: [{ id: 'newapi', name: 'AI Provider', source: 'builtin' }],
        runtimeConfig: {},
      } as any;
      const rules = {
        chat: { allowlist: ['free-chat'], mode: 'allowlist' },
        image: { allowlist: ['free-image'], mode: 'allowlist' },
        video: { allowlist: [], mode: 'allowlist' },
      };
      vi.mocked(AiInfraRepos).prototype.getAiProviderRuntimeState = vi
        .fn()
        .mockResolvedValue(state);
      planRuleMocks.resolvePlanModelRules.mockResolvedValue(rules);
      planRuleMocks.isModelAllowedByPlanRules.mockImplementation(
        (_rules, modelId, modelType) =>
          (modelType === 'chat' && modelId === 'free-chat') ||
          (modelType === 'image' && modelId === 'free-image'),
      );

      const caller = aiProviderRouter.createCaller(createMockContext());
      const result = await caller.getAiProviderRuntimeState({});

      expect(result.enabledAiModels.map((m) => m.id)).toEqual(['free-chat', 'free-image']);
      expect(result.enabledChatAiProviders.map((p) => p.id)).toEqual(['newapi']);
      expect(result.enabledImageAiProviders.map((p) => p.id)).toEqual(['newapi']);
      expect(result.enabledVideoAiProviders).toEqual([]);
    });
  });

  describe('removeAiProvider', () => {
    it('should remove AI provider', async () => {
      const mockDelete = vi.fn();
      vi.mocked(AiProviderModel).prototype.delete = mockDelete;

      const caller = aiProviderRouter.createCaller(createMockContext());
      await caller.removeAiProvider({ id: mockProviderId });

      expect(mockDelete).toHaveBeenCalledWith(mockProviderId);
    });
  });

  describe('toggleProviderEnabled', () => {
    it('should toggle provider enabled state', async () => {
      const mockToggle = vi.fn();
      vi.mocked(AiProviderModel).prototype.toggleProviderEnabled = mockToggle;

      const caller = aiProviderRouter.createCaller(createMockContext());
      await caller.toggleProviderEnabled({
        id: mockProviderId,
        enabled: true,
      });

      expect(mockToggle).toHaveBeenCalledWith(mockProviderId, true);
    });

    it('should reject disabling the official provider', async () => {
      const mockToggle = vi.fn();
      vi.mocked(AiProviderModel).prototype.toggleProviderEnabled = mockToggle;

      const caller = aiProviderRouter.createCaller(createMockContext());

      await expect(
        caller.toggleProviderEnabled({
          enabled: false,
          id: 'lobehub',
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: OFFICIAL_PROVIDER_DISABLE_ERROR,
      });

      expect(mockToggle).not.toHaveBeenCalled();
    });
  });

  describe('updateAiProvider', () => {
    it('should update AI provider', async () => {
      const mockUpdate = vi.fn();
      vi.mocked(AiProviderModel).prototype.update = mockUpdate;

      const caller = aiProviderRouter.createCaller(createMockContext());
      await caller.updateAiProvider({
        id: mockProviderId,
        value: { name: 'Updated Provider' },
      });

      expect(mockUpdate).toHaveBeenCalledWith(mockProviderId, {
        name: 'Updated Provider',
      });
    });
  });

  describe('updateAiProviderConfig', () => {
    it('should update AI provider config', async () => {
      const mockUpdateConfig = vi.fn();
      vi.mocked(AiProviderModel).prototype.updateConfig = mockUpdateConfig;

      const caller = aiProviderRouter.createCaller(createMockContext());
      await caller.updateAiProviderConfig({
        id: mockProviderId,
        value: { checkModel: 'gpt-4' },
      });

      expect(mockUpdateConfig).toHaveBeenCalledWith(
        mockProviderId,
        { checkModel: 'gpt-4' },
        mockGateKeeper.encrypt,
        KeyVaultsGateKeeper.getUserKeyVaults,
      );
    });
  });

  describe('updateAiProviderOrder', () => {
    it('should update AI provider order', async () => {
      const mockUpdateOrder = vi.fn();
      vi.mocked(AiProviderModel).prototype.updateOrder = mockUpdateOrder;

      const sortMap = [{ id: mockProviderId, sort: 1 }];
      const caller = aiProviderRouter.createCaller(createMockContext());
      await caller.updateAiProviderOrder({ sortMap });

      expect(mockUpdateOrder).toHaveBeenCalledWith(sortMap);
    });
  });
});
