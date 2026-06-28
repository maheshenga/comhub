// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getBusinessModelRuntimeHooks } from './model-runtime';

const mocks = vi.hoisted(() => ({
  assertCommercialChatBudget: vi.fn(),
  assertCommercialMinimumBudget: vi.fn(),
  assertModelPolicyAllowed: vi.fn(),
  assertPlanModelAllowed: vi.fn(),
  getServerDB: vi.fn(),
  recordCommercialAiUsage: vi.fn(),
  recordCommercialChatUsage: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: mocks.getServerDB,
}));

vi.mock('./commercialBilling', () => ({
  assertCommercialChatBudget: mocks.assertCommercialChatBudget,
  assertCommercialMinimumBudget: mocks.assertCommercialMinimumBudget,
  recordCommercialAiUsage: mocks.recordCommercialAiUsage,
  recordCommercialChatUsage: mocks.recordCommercialChatUsage,
}));

vi.mock('./planModelRules', () => ({
  assertPlanModelAllowed: mocks.assertPlanModelAllowed,
}));

vi.mock('./modelPolicy', () => ({
  assertModelPolicyAllowed: mocks.assertModelPolicyAllowed,
}));

describe('getBusinessModelRuntimeHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerDB.mockResolvedValue({ id: 'db' });
  });

  it('should check commercial budget before chat starts', async () => {
    const hooks = getBusinessModelRuntimeHooks('user-1', 'newapi', {
      groupKey: 'pro',
      groupName: 'Pro Group',
      instanceId: 'instance-pro',
      instanceName: 'NewAPI Pro',
    });
    const payload = {
      messages: [{ content: 'hello', role: 'user' }],
      model: 'gpt-test',
    } as any;

    await hooks?.beforeChat?.(payload);

    expect(mocks.assertCommercialChatBudget).toHaveBeenCalledWith({
      db: { id: 'db' },
      payload,
      provider: 'newapi',
      userId: 'user-1',
    });
    expect(mocks.assertPlanModelAllowed).toHaveBeenCalledWith({
      db: { id: 'db' },
      model: 'gpt-test',
      modelType: 'chat',
      groupKey: 'pro',
      userId: 'user-1',
    });
  });

  it('should check commercial budget before structured output starts', async () => {
    const hooks = getBusinessModelRuntimeHooks('user-1', 'newapi');
    const payload = {
      messages: [{ content: 'hello', role: 'user' }],
      model: 'gpt-test',
      schema: { name: 'result', schema: { properties: {}, type: 'object' } },
    } as any;

    await hooks?.beforeGenerateObject?.(payload);

    expect(mocks.assertCommercialChatBudget).toHaveBeenCalledWith({
      db: { id: 'db' },
      payload,
      provider: 'newapi',
      userId: 'user-1',
    });
    expect(mocks.assertPlanModelAllowed).toHaveBeenCalledWith({
      db: { id: 'db' },
      model: 'gpt-test',
      modelType: 'chat',
      userId: 'user-1',
    });
  });

  it('should check minimum commercial budget before embeddings start', async () => {
    const hooks = getBusinessModelRuntimeHooks('user-1', 'newapi');

    await hooks?.beforeEmbeddings?.({ input: 'hello', model: 'embedding-test' });

    expect(mocks.assertCommercialMinimumBudget).toHaveBeenCalledWith({
      db: { id: 'db' },
      model: 'embedding-test',
      provider: 'newapi',
      userId: 'user-1',
    });
    expect(mocks.assertPlanModelAllowed).toHaveBeenCalledWith({
      db: { id: 'db' },
      model: 'embedding-test',
      modelType: 'embedding',
      userId: 'user-1',
    });
  });

  it('should check policy, plan rules, and minimum budget before image generation starts', async () => {
    const hooks = getBusinessModelRuntimeHooks('user-1', 'newapi', {
      groupKey: 'image-pro',
      groupName: 'Image Pro',
      instanceId: 'instance-image',
      instanceName: 'Image Provider',
    });

    await hooks?.beforeCreateImage?.({
      model: 'image-test',
      params: { height: 1024, prompt: 'hello', width: 1024 },
    } as any);

    expect(mocks.assertModelPolicyAllowed).toHaveBeenCalledWith({
      db: { id: 'db' },
      model: 'image-test',
      provider: 'newapi',
      usageType: 'image',
    });
    expect(mocks.assertPlanModelAllowed).toHaveBeenCalledWith({
      db: { id: 'db' },
      groupKey: 'image-pro',
      model: 'image-test',
      modelType: 'image',
      userId: 'user-1',
    });
    expect(mocks.assertCommercialMinimumBudget).toHaveBeenCalledWith({
      db: { id: 'db' },
      model: 'image-test',
      provider: 'newapi',
      userId: 'user-1',
    });
  });

  it('should check policy, plan rules, and minimum budget before video generation starts', async () => {
    const hooks = getBusinessModelRuntimeHooks('user-1', 'newapi', {
      groupKey: 'video-pro',
      groupName: 'Video Pro',
      instanceId: 'instance-video',
      instanceName: 'Video Provider',
    });

    await hooks?.beforeCreateVideo?.({
      model: 'video-test',
      params: { prompt: 'hello' },
    } as any);

    expect(mocks.assertModelPolicyAllowed).toHaveBeenCalledWith({
      db: { id: 'db' },
      model: 'video-test',
      provider: 'newapi',
      usageType: 'video',
    });
    expect(mocks.assertPlanModelAllowed).toHaveBeenCalledWith({
      db: { id: 'db' },
      groupKey: 'video-pro',
      model: 'video-test',
      modelType: 'video',
      userId: 'user-1',
    });
    expect(mocks.assertCommercialMinimumBudget).toHaveBeenCalledWith({
      db: { id: 'db' },
      model: 'video-test',
      provider: 'newapi',
      userId: 'user-1',
    });
  });

  it('should record final chat usage with assistant message metadata', async () => {
    const routeMetadata = {
      groupKey: 'pro',
      groupMultiplier: 1.5,
      groupName: 'Pro Group',
      instanceId: 'instance-pro',
      instanceName: 'NewAPI Pro',
    };
    const hooks = getBusinessModelRuntimeHooks('user-1', 'newapi', routeMetadata);

    await hooks?.onChatFinal?.(
      {
        text: 'done',
        usage: { cost: 0.25, totalInputTokens: 100, totalOutputTokens: 50, totalTokens: 150 },
      },
      {
        options: {
          metadata: {
            assistantMessageId: 'assistant-message-1',
            operationId: 'operation-1',
          },
        },
        payload: {
          messages: [{ content: 'hello', role: 'user' }],
          model: 'gpt-test',
        } as any,
      },
    );

    expect(mocks.recordCommercialChatUsage).toHaveBeenCalledWith({
      db: { id: 'db' },
      messageId: 'assistant-message-1',
      model: 'gpt-test',
      operationId: 'operation-1',
      provider: 'newapi',
      routeMetadata,
      usage: { cost: 0.25, totalInputTokens: 100, totalOutputTokens: 50, totalTokens: 150 },
      userId: 'user-1',
    });
  });

  it('should skip final billing when usage is missing', async () => {
    const hooks = getBusinessModelRuntimeHooks('user-1', 'newapi');

    await hooks?.onChatFinal?.(
      { text: 'done' },
      {
        options: { metadata: { assistantMessageId: 'assistant-message-1' } },
        payload: {
          messages: [{ content: 'hello', role: 'user' }],
          model: 'gpt-test',
        } as any,
      },
    );

    expect(mocks.recordCommercialChatUsage).not.toHaveBeenCalled();
  });

  it('should skip and warn when no idempotent billing reference is available', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hooks = getBusinessModelRuntimeHooks('user-1', 'newapi');

    await hooks?.onChatFinal?.(
      { text: 'done', usage: { cost: 0.25, totalTokens: 150 } },
      {
        options: { metadata: {} },
        payload: {
          messages: [{ content: 'hello', role: 'user' }],
          model: 'gpt-test',
        } as any,
      },
    );

    expect(mocks.recordCommercialChatUsage).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[billing] skip chat usage charge because no billing reference metadata',
      { model: 'gpt-test', provider: 'newapi' },
    );

    warnSpy.mockRestore();
  });

  it('should allow callers to explicitly skip commercial billing', async () => {
    const hooks = getBusinessModelRuntimeHooks('user-1', 'newapi');

    await hooks?.onChatFinal?.(
      { text: 'done', usage: { cost: 0.25, totalTokens: 150 } },
      {
        options: {
          metadata: {
            assistantMessageId: 'assistant-message-1',
            skipCommercialBilling: true,
          },
        },
        payload: {
          messages: [{ content: 'hello', role: 'user' }],
          model: 'gpt-test',
        } as any,
      },
    );

    expect(mocks.recordCommercialChatUsage).not.toHaveBeenCalled();
  });

  it('should record structured output usage with operation metadata', async () => {
    const hooks = getBusinessModelRuntimeHooks('user-1', 'newapi');

    await hooks?.onGenerateObjectFinal?.(
      { usage: { cost: 0.12, totalInputTokens: 60, totalOutputTokens: 20, totalTokens: 80 } },
      {
        options: { metadata: { operationId: 'operation-structured-1' } },
        payload: {
          messages: [{ content: 'hello', role: 'user' }],
          model: 'gpt-test',
        } as any,
      },
    );

    expect(mocks.recordCommercialAiUsage).toHaveBeenCalledWith({
      db: { id: 'db' },
      model: 'gpt-test',
      operationId: 'operation-structured-1',
      provider: 'newapi',
      referenceId: 'operation-structured-1',
      referenceType: 'model_runtime_generate_object',
      title: 'AI Structured Output Usage',
      usage: { cost: 0.12, totalInputTokens: 60, totalOutputTokens: 20, totalTokens: 80 },
      usageType: 'generate_object',
      userId: 'user-1',
    });
  });

  it('should record embeddings usage with operation metadata', async () => {
    const hooks = getBusinessModelRuntimeHooks('user-1', 'newapi');

    await hooks?.onEmbeddingsFinal?.(
      {
        latencyMs: 123,
        usage: { cost: 0.01, totalInputTokens: 100, totalTokens: 100 },
      },
      {
        options: { metadata: { operationId: 'operation-embeddings-1' } },
        payload: { input: 'hello', model: 'embedding-test' },
      },
    );

    expect(mocks.recordCommercialAiUsage).toHaveBeenCalledWith({
      db: { id: 'db' },
      model: 'embedding-test',
      operationId: 'operation-embeddings-1',
      provider: 'newapi',
      referenceId: 'operation-embeddings-1',
      referenceType: 'model_runtime_embeddings',
      title: 'AI Embeddings Usage',
      usage: { cost: 0.01, totalInputTokens: 100, totalTokens: 100 },
      usageType: 'embeddings',
      userId: 'user-1',
    });
  });
});
