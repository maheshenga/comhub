// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaRouter } from './index';
import { moduleAppRouter } from './moduleApp';

const {
  mockGetServerDB,
  mockGetSubscriptionPlan,
  mockRunModuleAppAction,
  mockModuleAppModel,
} = vi.hoisted(() => ({
  mockGetServerDB: vi.fn(),
  mockGetSubscriptionPlan: vi.fn(),
  mockRunModuleAppAction: vi.fn(),
  mockModuleAppModel: {
    createRecord: vi.fn(),
    createRun: vi.fn(),
    getAppDetail: vi.fn(),
  },
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: mockGetServerDB,
}));

vi.mock('@/business/server/user', () => ({
  getSubscriptionPlan: mockGetSubscriptionPlan,
}));

vi.mock('@/business/server/module-apps/runModuleAppAction', () => ({
  runModuleAppAction: mockRunModuleAppAction,
}));

vi.mock('@/database/models/moduleApp', () => ({
  ModuleAppModel: vi.fn(() => mockModuleAppModel),
}));

const APP_ID = '00000000-0000-4000-8000-000000000001';

const createCaller = () => moduleAppRouter.createCaller({ userId: 'user-1' } as any);

describe('moduleApp router registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerDB.mockResolvedValue({});
    mockGetSubscriptionPlan.mockResolvedValue('free');
    mockModuleAppModel.getAppDetail.mockResolvedValue({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: false, visible: true },
    });
    mockRunModuleAppAction.mockResolvedValue({
      artifactIds: [],
      billing: { chargedCredits: 0, fixedServiceFeeCharged: false },
      preview: 'Created',
      runId: 'run-1',
      status: 'succeeded',
    });
  });

  it('registers the moduleApp router on lambda root', () => {
    expect(lambdaRouter._def.record.moduleApp).toBeDefined();
  });

  it('denies record creation when the current plan cannot run the app', async () => {
    await expect(
      createCaller().createRecord({
        appId: APP_ID,
        collectionKey: 'items',
        data: { title: 'Blocked' },
        scopeType: 'personal',
        title: 'Blocked',
      }),
    ).rejects.toThrow('plan_run_denied');
    expect(mockModuleAppModel.createRecord).not.toHaveBeenCalled();
  });

  it('denies action runs when the current plan cannot run the app', async () => {
    await expect(
      createCaller().runAction({
        actionId: 'create_item',
        appId: APP_ID,
        input: { title: 'Blocked' },
        scopeType: 'personal',
      }),
    ).rejects.toThrow('plan_run_denied');
    expect(mockModuleAppModel.createRun).not.toHaveBeenCalled();
  });

  it('delegates allowed action runs to the module app runtime', async () => {
    const action = {
      id: 'create_item',
      inputSchema: { fields: [] },
      moduleMultiplier: 1,
      name: 'Create item',
      outputSchema: {},
      runtimeConfig: {},
      runtimeType: 'record_create',
    };
    mockModuleAppModel.getAppDetail.mockResolvedValue({
      actions: [action],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });

    await expect(
      createCaller().runAction({
        actionId: 'create_item',
        appId: APP_ID,
        input: { title: 'A' },
        scopeType: 'personal',
      }),
    ).resolves.toMatchObject({ runId: 'run-1', status: 'succeeded' });

    expect(mockRunModuleAppAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action,
        appId: APP_ID,
        input: { title: 'A' },
        model: mockModuleAppModel,
        scopeType: 'personal',
        userId: 'user-1',
      }),
    );
    expect(mockModuleAppModel.createRun).not.toHaveBeenCalled();
  });
});
