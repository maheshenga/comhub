// @vitest-environment node
import { ChatErrorType } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertCommercialChatBudget,
  assertCommercialMinimumBudget,
  estimateCommercialChatCredits,
  recordCommercialAiUsage,
  recordCommercialChatUsage,
} from './commercialBilling';

const mocks = vi.hoisted(() => ({
  canStartChatUsage: vi.fn(),
  consumeCreditsForAiUsage: vi.fn(),
  consumeCreditsForChatUsage: vi.fn(),
  getAiProviderModelList: vi.fn(),
  getAiProviderById: vi.fn(),
  getCreditAccountSummary: vi.fn(),
  getServerGlobalConfig: vi.fn(),
}));

vi.mock('@/database/models/aiProvider', () => ({
  AiProviderModel: vi.fn().mockImplementation(() => ({
    getAiProviderById: mocks.getAiProviderById,
  })),
}));

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn().mockImplementation(() => ({
    canStartChatUsage: mocks.canStartChatUsage,
    consumeCreditsForAiUsage: mocks.consumeCreditsForAiUsage,
    consumeCreditsForChatUsage: mocks.consumeCreditsForChatUsage,
    getCreditAccountSummary: mocks.getCreditAccountSummary,
  })),
}));

vi.mock('@/database/repositories/aiInfra', () => ({
  AiInfraRepos: vi.fn().mockImplementation(() => ({
    getAiProviderModelList: mocks.getAiProviderModelList,
  })),
}));

vi.mock('@/server/globalConfig', () => ({
  getServerGlobalConfig: mocks.getServerGlobalConfig,
}));

describe('estimateCommercialChatCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerGlobalConfig.mockResolvedValue({
      aiProvider: { openai: { enabled: true } },
    });
    mocks.getAiProviderById.mockResolvedValue({ keyVaults: {} });
    mocks.canStartChatUsage.mockResolvedValue(true);
    mocks.getCreditAccountSummary.mockResolvedValue({
      balance: 0,
      breakdown: {
        other: { available: 0, consumed: 0, credited: 0 },
        referral: { available: 0, consumed: 0, credited: 0 },
        subscription: { available: 0, consumed: 0, credited: 0 },
        topup: { available: 0, consumed: 0, credited: 0 },
      },
      currency: 'CREDITS',
      totalCredited: 0,
      totalDebited: 0,
      updatedAt: null,
    });
  });

  it('should estimate credits from model pricing and payload size', async () => {
    mocks.getAiProviderModelList.mockResolvedValue([
      {
        id: 'gpt-test',
        pricing: {
          units: [
            { name: 'textInput', rate: 0.5, strategy: 'fixed' },
            { name: 'textOutput', rate: 1, strategy: 'fixed' },
          ],
        },
      },
    ]);

    const result = await estimateCommercialChatCredits({
      db: {} as any,
      payload: {
        max_tokens: 500,
        messages: [{ content: 'Hello world', role: 'user' }],
        model: 'gpt-test',
      },
      provider: 'openai',
      userId: 'user-1',
    });

    expect(result).toBe(502);
  });

  it('should return undefined when model pricing is unavailable', async () => {
    mocks.getAiProviderModelList.mockResolvedValue([{ id: 'gpt-test' }]);

    const result = await estimateCommercialChatCredits({
      db: {} as any,
      payload: {
        messages: [{ content: 'Hello world', role: 'user' }],
        model: 'gpt-test',
      },
      provider: 'openai',
      userId: 'user-1',
    });

    expect(result).toBeUndefined();
  });

  it('should include structured balance details when blocking a paid chat', async () => {
    mocks.getAiProviderModelList.mockResolvedValue([
      {
        id: 'gpt-test',
        pricing: {
          units: [
            { name: 'textInput', rate: 0.5, strategy: 'fixed' },
            { name: 'textOutput', rate: 1, strategy: 'fixed' },
          ],
        },
      },
    ]);
    mocks.canStartChatUsage.mockResolvedValue(false);
    mocks.getCreditAccountSummary.mockResolvedValue({
      balance: 120,
      breakdown: {
        other: { available: 0, consumed: 0, credited: 0 },
        referral: { available: 0, consumed: 0, credited: 0 },
        subscription: { available: 120, consumed: 0, credited: 120 },
        topup: { available: 0, consumed: 0, credited: 0 },
      },
      currency: 'CREDITS',
      totalCredited: 120,
      totalDebited: 0,
      updatedAt: null,
    });

    await expect(
      assertCommercialChatBudget({
        db: {} as any,
        payload: {
          max_tokens: 500,
          messages: [{ content: 'Hello world', role: 'user' }],
          model: 'gpt-test',
        },
        provider: 'openai',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({
      error: {
        availableCredits: 120,
        currency: 'CREDITS',
        message: 'COMMERCIAL_BALANCE_EXHAUSTED',
        model: 'gpt-test',
        provider: 'openai',
        requiredCredits: 502,
        shortfallCredits: 382,
      },
      errorType: ChatErrorType.InsufficientBudgetForModel,
    });

    expect(mocks.canStartChatUsage).toHaveBeenCalledWith(502);
  });
});

describe('recordCommercialChatUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerGlobalConfig.mockResolvedValue({
      aiProvider: { openai: { enabled: true } },
    });
    mocks.getAiProviderById.mockResolvedValue({ keyVaults: {} });
    mocks.canStartChatUsage.mockResolvedValue(true);
    mocks.getAiProviderModelList.mockResolvedValue([
      {
        id: 'gpt-test',
        pricing: {
          units: [
            { name: 'textInput', rate: 0.5, strategy: 'fixed' },
            { name: 'textOutput', rate: 1, strategy: 'fixed' },
          ],
        },
      },
    ]);
    mocks.consumeCreditsForAiUsage.mockResolvedValue({ id: 'ledger-1' });
    mocks.consumeCreditsForChatUsage.mockResolvedValue({ id: 'ledger-1' });
  });

  it('should trust positive gateway cost and record gateway costSource', async () => {
    await recordCommercialChatUsage({
      db: {} as any,
      messageId: 'assistant-message-1',
      model: 'gpt-test',
      operationId: 'operation-1',
      provider: 'openai',
      usage: { cost: 0.25, totalInputTokens: 100, totalOutputTokens: 50, totalTokens: 150 },
      userId: 'user-1',
    });

    expect(mocks.consumeCreditsForAiUsage).toHaveBeenCalledWith({
      model: 'gpt-test',
      operationId: 'operation-1',
      provider: 'openai',
      referenceId: 'assistant-message-1',
      referenceType: 'assistant_message',
      title: 'AI Chat Usage',
      usage: {
        cost: 0.25,
        costSource: 'gateway',
        totalInputTokens: 100,
        totalOutputTokens: 50,
        totalTokens: 150,
      },
      usageType: 'chat',
    });
  });

  it('should pass newapi route metadata to final credit consumption', async () => {
    await recordCommercialChatUsage({
      db: {} as any,
      messageId: 'assistant-message-newapi-route-1',
      model: 'gpt-test',
      provider: 'newapi',
      routeMetadata: {
        groupKey: 'pro',
        groupMultiplier: 1.5,
        groupName: 'Pro Group',
        instanceId: 'instance-pro',
        instanceName: 'NewAPI Pro',
        providerType: 'deepseek',
      },
      usage: { cost: 0.25, totalTokens: 100 },
      userId: 'user-1',
    });

    expect(mocks.consumeCreditsForAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        routeMetadata: {
          groupKey: 'pro',
          groupMultiplier: 1.5,
          groupName: 'Pro Group',
          instanceId: 'instance-pro',
          instanceName: 'NewAPI Pro',
          providerType: 'deepseek',
        },
      }),
    );
  });

  it('should compute local pricing when gateway cost is missing', async () => {
    await recordCommercialChatUsage({
      db: {} as any,
      messageId: 'assistant-message-2',
      model: 'gpt-test',
      provider: 'openai',
      usage: { totalInputTokens: 1_000_000, totalOutputTokens: 2_000_000 },
      userId: 'user-1',
    });

    expect(mocks.consumeCreditsForAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        usage: expect.objectContaining({
          cost: 2.5,
          costSource: 'local-pricing',
        }),
      }),
    );
  });

  it('should use fallback pricing when model pricing is unavailable', async () => {
    mocks.getAiProviderModelList.mockResolvedValue([{ id: 'gpt-test' }]);

    await recordCommercialChatUsage({
      db: {} as any,
      messageId: 'assistant-message-3',
      model: 'gpt-test',
      provider: 'openai',
      usage: { totalInputTokens: 1_000_000, totalOutputTokens: 1_000_000 },
      userId: 'user-1',
    });

    expect(mocks.consumeCreditsForAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        usage: expect.objectContaining({
          cost: 18,
          costSource: 'fallback-rate',
        }),
      }),
    );
  });

  it('should not charge when the user has self-managed provider credentials', async () => {
    mocks.getAiProviderById.mockResolvedValue({ keyVaults: { apiKey: 'user-key' } });

    const result = await recordCommercialChatUsage({
      db: {} as any,
      messageId: 'assistant-message-4',
      model: 'gpt-test',
      provider: 'openai',
      usage: { cost: 0.25, totalTokens: 100 },
      userId: 'user-1',
    });

    expect(result).toBeNull();
    expect(mocks.consumeCreditsForAiUsage).not.toHaveBeenCalled();
  });

  it('should still charge branding provider usage even when the user configured a personal key', async () => {
    mocks.getAiProviderById.mockResolvedValue({ keyVaults: { apiKey: 'user-key' } });

    await recordCommercialChatUsage({
      db: {} as any,
      messageId: 'assistant-message-newapi-1',
      model: 'gpt-test',
      provider: 'newapi',
      usage: { cost: 0.25, totalTokens: 100 },
      userId: 'user-1',
    });

    expect(mocks.consumeCreditsForAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'newapi',
        referenceId: 'assistant-message-newapi-1',
      }),
    );
  });

  it('should record non-chat model runtime usage with a dedicated reference type', async () => {
    await recordCommercialAiUsage({
      db: {} as any,
      model: 'gpt-test',
      operationId: 'operation-5',
      provider: 'openai',
      referenceId: 'operation-5',
      referenceType: 'model_runtime_generate_object',
      title: 'AI Structured Output Usage',
      usage: { cost: 0.12, totalTokens: 100 },
      usageType: 'generate_object',
      userId: 'user-1',
    });

    expect(mocks.consumeCreditsForAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'operation-5',
        referenceId: 'operation-5',
        referenceType: 'model_runtime_generate_object',
        title: 'AI Structured Output Usage',
        usage: expect.objectContaining({ cost: 0.12, costSource: 'gateway' }),
        usageType: 'generate_object',
      }),
    );
  });

  it('should treat embeddings totalTokens as input tokens for local pricing', async () => {
    mocks.getAiProviderModelList.mockResolvedValue([
      {
        id: 'embedding-test',
        pricing: {
          units: [{ name: 'textInput', rate: 0.1, strategy: 'fixed' }],
        },
      },
    ]);

    await recordCommercialAiUsage({
      db: {} as any,
      model: 'embedding-test',
      provider: 'openai',
      referenceId: 'embedding-operation-1',
      referenceType: 'model_runtime_embeddings',
      title: 'AI Embeddings Usage',
      usage: { totalTokens: 1_000_000 },
      usageType: 'embeddings',
      userId: 'user-1',
    });

    expect(mocks.consumeCreditsForAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: 'embedding-operation-1',
        usage: expect.objectContaining({
          cost: 0.1,
          costSource: 'local-pricing',
        }),
        usageType: 'embeddings',
      }),
    );
  });
});

describe('assertCommercialMinimumBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiProviderById.mockResolvedValue({ keyVaults: {} });
    mocks.getCreditAccountSummary.mockResolvedValue({
      balance: 0,
      breakdown: {
        other: { available: 0, consumed: 0, credited: 0 },
        referral: { available: 0, consumed: 0, credited: 0 },
        subscription: { available: 0, consumed: 0, credited: 0 },
        topup: { available: 0, consumed: 0, credited: 0 },
      },
      currency: 'CREDITS',
      totalCredited: 0,
      totalDebited: 0,
      updatedAt: null,
    });
  });

  it('should check a minimum commercial balance for non-chat calls', async () => {
    mocks.canStartChatUsage.mockResolvedValue(true);

    await assertCommercialMinimumBudget({
      db: {} as any,
      model: 'embedding-test',
      provider: 'openai',
      requiredCredits: 3,
      userId: 'user-1',
    });

    expect(mocks.canStartChatUsage).toHaveBeenCalledWith(3);
  });

  it('should throw with structured balance details when minimum balance is unavailable', async () => {
    mocks.canStartChatUsage.mockResolvedValue(false);

    await expect(
      assertCommercialMinimumBudget({
        db: {} as any,
        model: 'embedding-test',
        provider: 'openai',
        requiredCredits: 3,
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({
      error: {
        availableCredits: 0,
        currency: 'CREDITS',
        message: 'COMMERCIAL_BALANCE_EXHAUSTED',
        model: 'embedding-test',
        provider: 'openai',
        requiredCredits: 3,
        shortfallCredits: 3,
      },
      errorType: ChatErrorType.InsufficientBudgetForModel,
    });
  });
});
