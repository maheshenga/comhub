// @vitest-environment node
import { createHash } from 'node:crypto';

import type { AnyTRPCProcedure } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z, type ZodTypeAny } from 'zod';

import { authedProcedure } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

import { lambdaRouter } from './index';
import { moduleAppRouter } from './moduleApp';
import { moduleAppCommerceProcedures } from './moduleApp/commerce';
import { moduleAppDataProcedures, moduleAppProcedure } from './moduleApp/data';
import { moduleAppDeveloperProcedures } from './moduleApp/developer';
import { moduleAppInstallationSecretProcedures } from './moduleApp/installationSecrets';
import { moduleAppMarketProcedures } from './moduleApp/market';
import { moduleAppRuntimeProcedures } from './moduleApp/runtime';
import { moduleAppWorkflowProcedures } from './moduleApp/workflow';

const {
  mockGetServerDB,
  mockGetSubscriptionPlan,
  mockGetWorkspaceMember,
  mockIngestionService,
  mockCreateModuleAppTextGenerator,
  mockAppEnv,
  mockModuleAppGateway,
  mockGetServerModuleAppRuntimeConfig,
  mockRuntimeClientHealthCheck,
  mockRuntimeClientInvoke,
  mockRunModuleAppAction,
  mockModuleAppCommerceModel,
  mockModuleAppPaymentModel,
  mockModuleAppPaymentService,
  mockEncryptInstallationSecret,
  mockCreateConfiguredModuleAppAlipayClient,
  mockCreatePaymentAdapter,
  mockGetServerPaymentConfig,
  mockListCheckoutPaymentMethods,
  mockResolvePaymentMethod,
  mockModuleAppModel,
  mockModuleAppDeveloperModel,
  mockModuleAppWorkflowModel,
  mockSignModuleAppCapability,
  mockVerifyModuleAppCapability,
  mockTextGenerator,
} = vi.hoisted(() => ({
  mockAppEnv: {
    MODULE_APP_ALIPAY_ENABLED: false,
    MODULE_APP_ALIPAY_PAYMENT_CREATION_ENABLED: false,
    MODULE_APP_ALIPAY_NOTIFY_URL: 'https://app.example.com/api/webhooks/alipay/module-app',
    MODULE_APP_ALIPAY_RETURN_URL: 'https://app.example.com/apps/order-return',
    MODULE_APP_EXECUTION_ENABLED: true,
    MODULE_APP_PUBLIC_EXECUTION_ENABLED: true,
    MODULE_APP_PUBLISHER_ALLOWLIST: [] as string[],
    MODULE_APP_RUNTIME_APP_ALLOWLIST: ['00000000-0000-4000-8000-000000000001'],
    MODULE_APP_RUNTIME_INVOCATION_ENABLED: true,
    MODULE_APP_RUNTIME_PUBLIC_ORIGIN: 'https://module-runtime.example.com',
  },
  mockGetServerModuleAppRuntimeConfig: vi.fn(),
  mockRuntimeClientHealthCheck: vi.fn(),
  mockRuntimeClientInvoke: vi.fn(),
  mockGetServerDB: vi.fn(),
  mockGetSubscriptionPlan: vi.fn(),
  mockGetWorkspaceMember: vi.fn(),
  mockCreateModuleAppTextGenerator: vi.fn(),
  mockIngestionService: {
    issueUpload: vi.fn(),
    submitUpload: vi.fn(),
  },
  mockModuleAppGateway: { call: vi.fn() },
  mockRunModuleAppAction: vi.fn(),
  mockModuleAppCommerceModel: {
    cancelOrder: vi.fn(),
    createOrder: vi.fn(),
    listCatalog: vi.fn(),
    listOrders: vi.fn(),
    quoteProduct: vi.fn(),
    resolveEntitlementContext: vi.fn(),
    resolveLicense: vi.fn(),
  },
  mockModuleAppPaymentService: {
    createPayment: vi.fn(),
  },
  mockModuleAppPaymentModel: {
    getPaymentAttemptByOrderId: vi.fn(),
  },
  mockEncryptInstallationSecret: vi.fn(),
  mockCreateConfiguredModuleAppAlipayClient: vi.fn(() => ({ provider: 'alipay' })),
  mockCreatePaymentAdapter: vi.fn(() => ({ method: 'alipay', provider: 'alipay' })),
  mockGetServerPaymentConfig: vi.fn(),
  mockListCheckoutPaymentMethods: vi.fn(),
  mockResolvePaymentMethod: vi.fn(),
  mockModuleAppModel: {
    assertInstallationAccess: vi.fn(),
    changeInstallationVersion: vi.fn(),
    createRecord: vi.fn(),
    createRun: vi.fn(),
    deleteInstallationSecret: vi.fn(),
    getAppDetail: vi.fn(),
    getInstallationVersionState: vi.fn(),
    getInstallationSecretState: vi.fn(),
    getLaunchInstallationContext: vi.fn(),
    getRuntimeManifest: vi.fn(),
    installPersonalApp: vi.fn(),
    installWorkspaceApp: vi.fn(),
    listAdminPackageSubmissions: vi.fn(),
    listArtifacts: vi.fn(),
    listInstalledApps: vi.fn(),
    listInstalledAppsPage: vi.fn(),
    listInstallationSecrets: vi.fn(),
    listMarketplaceApps: vi.fn(),
    uninstallWorkspaceApp: vi.fn(),
    upsertInstallationSecret: vi.fn(),
  },
  mockModuleAppDeveloperModel: {
    getFinance: vi.fn(),
    getFinanceSummary: vi.fn(),
    getPublisherProfile: vi.fn(),
    listApplications: vi.fn(),
    listPayouts: vi.fn(),
    listRevenue: vi.fn(),
    listSubmissions: vi.fn(),
    listVersions: vi.fn(),
    rollbackVersion: vi.fn(),
    setPublication: vi.fn(),
    upsertPublisherProfile: vi.fn(),
  },
  mockModuleAppWorkflowModel: {
    cancelRun: vi.fn(),
    getRun: vi.fn(),
    listNodes: vi.fn(),
  },
  mockSignModuleAppCapability: vi.fn(),
  mockTextGenerator: vi.fn(),
  mockVerifyModuleAppCapability: vi.fn(),
}));

vi.mock('@/envs/app', () => ({
  appEnv: mockAppEnv,
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

vi.mock('@/server/services/moduleAppPackage/ingestion', () => ({
  ModuleAppPackageIngestionService: class {
    constructor() {
      return mockIngestionService;
    }
  },
}));

vi.mock('@/server/services/moduleAppAi', () => ({
  createModuleAppTextGenerator: mockCreateModuleAppTextGenerator,
}));

vi.mock('@/server/services/moduleAppRuntime/capability', () => ({
  signModuleAppCapability: mockSignModuleAppCapability,
  verifyModuleAppCapability: mockVerifyModuleAppCapability,
}));

vi.mock('@/database/models/workspaceMember', () => ({
  WorkspaceMemberModel: class {
    constructor() {
      return { getMember: mockGetWorkspaceMember };
    }
  },
}));

vi.mock('@/server/services/moduleAppRuntime/gateway', () => ({
  createModuleAppCapabilityGateway: vi.fn(() => mockModuleAppGateway),
}));

vi.mock('@/server/services/moduleAppRuntime/client', () => ({
  ModuleAppRuntimeClient: class {
    constructor() {
      return {
        healthCheck: mockRuntimeClientHealthCheck,
        invoke: mockRuntimeClientInvoke,
      };
    }
  },
}));

vi.mock('@/server/services/moduleAppRuntime/config', () => ({
  getServerModuleAppRuntimeConfig: mockGetServerModuleAppRuntimeConfig,
}));

vi.mock('@/database/models/moduleApp', () => ({
  ModuleAppModel: class {
    constructor() {
      return mockModuleAppModel;
    }
  },
}));

vi.mock('@/database/models/moduleAppDeveloper', () => ({
  ModuleAppDeveloperModel: class {
    constructor() {
      return mockModuleAppDeveloperModel;
    }
  },
}));

vi.mock('@/database/models/moduleAppCommerce', () => ({
  ModuleAppCommerceModel: class {
    constructor() {
      return mockModuleAppCommerceModel;
    }
  },
}));

vi.mock('@/database/models/moduleAppPayment', () => ({
  ModuleAppPaymentModel: class {
    constructor() {
      return mockModuleAppPaymentModel;
    }
  },
}));

vi.mock('@/business/server/module-apps/payments/service', () => ({
  ModuleAppPaymentService: class {
    constructor() {
      return mockModuleAppPaymentService;
    }
  },
}));

vi.mock('@/server/services/moduleAppPayments/alipay/client', () => ({
  createConfiguredModuleAppAlipayClient: mockCreateConfiguredModuleAppAlipayClient,
}));

vi.mock('@/server/services/payments/config', () => ({
  buildPaymentCallbackUrl: vi.fn(() => 'https://app.example.com/api/webhooks/payments/alipay'),
  buildPaymentReturnUrl: vi.fn(() => 'https://app.example.com/apps'),
  getServerPaymentConfig: mockGetServerPaymentConfig,
  listCheckoutPaymentMethods: mockListCheckoutPaymentMethods,
  resolvePaymentMethod: mockResolvePaymentMethod,
}));

vi.mock('@/server/services/payments/factory', () => ({
  createPaymentAdapter: mockCreatePaymentAdapter,
}));

vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: {
    initWithEnvKey: vi.fn(async () => ({ encrypt: mockEncryptInstallationSecret })),
  },
}));

vi.mock('@/database/models/moduleAppWorkflow', () => ({
  ModuleAppWorkflowModel: class {
    constructor() {
      return mockModuleAppWorkflowModel;
    }
  },
}));

const APP_ID = '00000000-0000-4000-8000-000000000001';

const createCaller = () => moduleAppRouter.createCaller({ userId: 'user-1' } as any);
const moduleAppProcedureRecord = moduleAppRouter._def.record as unknown as Record<
  string,
  AnyTRPCProcedure
>;

const serializeParserContract = (
  value: unknown,
  seen = new Map<object, number>(),
  key?: PropertyKey,
): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'bigint') {
    return `${typeof value}:${String(value)}`;
  }
  if (typeof value === 'string') return `string:${JSON.stringify(value)}`;
  if (typeof value === 'symbol') return `symbol:${String(value)}`;
  if (typeof value === 'function') {
    if (key === 'shape') return `shape:${serializeParserContract(value(), seen)}`;
    return `function:${value.toString()}`;
  }

  const object = value as Record<PropertyKey, unknown>;
  const reference = seen.get(object);
  if (reference !== undefined) return `reference:${reference}`;
  seen.set(object, seen.size);

  if (value instanceof Date) return `date:${value.toISOString()}`;
  if (value instanceof RegExp) return `regexp:${value.toString()}`;
  if (Array.isArray(value)) {
    return `array:[${value.map((item) => serializeParserContract(item, seen)).join(',')}]`;
  }
  if (value instanceof Map) {
    const entries = [...value.entries()]
      .map(
        ([entryKey, entryValue]) =>
          `${serializeParserContract(entryKey, seen)}=>${serializeParserContract(entryValue, seen)}`,
      )
      .sort();
    return `map:{${entries.join(',')}}`;
  }
  if (value instanceof Set) {
    const entries = [...value].map((item) => serializeParserContract(item, seen)).sort();
    return `set:{${entries.join(',')}}`;
  }

  const constructorName = Object.getPrototypeOf(value)?.constructor?.name ?? 'Object';
  const entries = Reflect.ownKeys(object)
    .sort((left, right) => String(left).localeCompare(String(right)))
    .map(
      (entryKey) =>
        `${String(entryKey)}:${serializeParserContract(object[entryKey], seen, entryKey)}`,
    );
  return `${constructorName}:{${entries.join(',')}}`;
};

const fingerprintParser = (parser: ZodTypeAny) =>
  createHash('sha256').update(serializeParserContract(parser)).digest('hex');

describe('moduleApp router registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerDB.mockResolvedValue({});
    mockGetSubscriptionPlan.mockResolvedValue('free');
    mockGetWorkspaceMember.mockResolvedValue({ role: 'owner', workspaceId: 'workspace-1' });
    mockAppEnv.MODULE_APP_EXECUTION_ENABLED = true;
    mockAppEnv.MODULE_APP_PUBLIC_EXECUTION_ENABLED = true;
    mockAppEnv.MODULE_APP_PUBLISHER_ALLOWLIST = [];
    mockAppEnv.MODULE_APP_RUNTIME_APP_ALLOWLIST = [APP_ID];
    mockAppEnv.MODULE_APP_RUNTIME_INVOCATION_ENABLED = true;
    mockAppEnv.MODULE_APP_RUNTIME_PUBLIC_ORIGIN = 'https://module-runtime.example.com';
    mockAppEnv.MODULE_APP_ALIPAY_ENABLED = false;
    mockAppEnv.MODULE_APP_ALIPAY_PAYMENT_CREATION_ENABLED = false;
    mockGetServerModuleAppRuntimeConfig.mockImplementation(async () => {
      const executionEnabled = Boolean(mockAppEnv.MODULE_APP_EXECUTION_ENABLED);
      return {
        connections: {
          internalToken: 'runtime-token',
          internalUrl: 'http://module-runtime:3210',
          publicOrigin: mockAppEnv.MODULE_APP_RUNTIME_PUBLIC_ORIGIN,
        },
        switches: {
          executionEnabled,
          invocationEnabled:
            executionEnabled && Boolean(mockAppEnv.MODULE_APP_RUNTIME_INVOCATION_ENABLED),
          publicExecutionEnabled:
            executionEnabled && Boolean(mockAppEnv.MODULE_APP_PUBLIC_EXECUTION_ENABLED),
          scheduleDispatchEnabled: false,
          workflowPrivilegedExecutorsEnabled: false,
        },
      };
    });
    mockRuntimeClientHealthCheck.mockResolvedValue({ status: 'ready' });
    mockGetServerPaymentConfig.mockResolvedValue({
      defaultProvider: 'alipay',
      enabled: false,
      moduleAppEnabled: false,
      publicBaseUrl: 'https://app.example.com',
    });
    mockListCheckoutPaymentMethods.mockReturnValue([]);
    mockResolvePaymentMethod.mockReturnValue({
      id: 'alipay',
      label: 'Alipay',
      provider: 'alipay',
    });
    mockModuleAppPaymentService.createPayment.mockResolvedValue({
      checkout: {
        fields: { sign: 'signed' },
        method: 'POST',
        type: 'form',
        url: 'https://openapi.alipay.com/gateway.do',
      },
      method: 'alipay',
      outTradeNo: 'out-1',
      provider: 'alipay',
    });
    mockModuleAppModel.getAppDetail.mockResolvedValue({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: false, visible: true },
    });
    mockModuleAppModel.getInstallationVersionState.mockResolvedValue(null);
    mockModuleAppModel.changeInstallationVersion.mockResolvedValue({
      changed: true,
      installationId: 'installation-1',
      operation: 'upgrade',
      previousVersionId: '00000000-0000-4000-8000-000000000002',
      versionId: '00000000-0000-4000-8000-000000000003',
    });
    mockModuleAppModel.installPersonalApp.mockResolvedValue({ changed: true });
    mockModuleAppModel.installWorkspaceApp.mockResolvedValue({ changed: true });
    mockModuleAppModel.uninstallWorkspaceApp.mockResolvedValue({ ok: true });
    mockModuleAppModel.listMarketplaceApps.mockResolvedValue([]);
    mockModuleAppModel.listInstalledApps.mockResolvedValue([]);
    mockModuleAppModel.listInstalledAppsPage.mockResolvedValue({ items: [], nextCursor: null });
    mockModuleAppModel.listInstallationSecrets.mockResolvedValue([]);
    mockModuleAppModel.getInstallationSecretState.mockResolvedValue({
      items: [],
      missingKeys: [],
      ready: true,
      requiredKeys: [],
    });
    mockModuleAppModel.getRuntimeManifest.mockResolvedValue({ actions: [], pages: [] });
    mockModuleAppModel.upsertInstallationSecret.mockResolvedValue({ ok: true });
    mockModuleAppModel.deleteInstallationSecret.mockResolvedValue({ ok: true });
    mockModuleAppDeveloperModel.getFinance.mockResolvedValue({
      payouts: [],
      revenue: [],
      summary: [],
    });
    mockModuleAppDeveloperModel.getFinanceSummary.mockResolvedValue([]);
    mockModuleAppDeveloperModel.getPublisherProfile.mockResolvedValue(null);
    mockModuleAppDeveloperModel.listApplications.mockResolvedValue({ items: [], nextCursor: null });
    mockModuleAppDeveloperModel.listPayouts.mockResolvedValue({ items: [], nextCursor: null });
    mockModuleAppDeveloperModel.listRevenue.mockResolvedValue({ items: [], nextCursor: null });
    mockModuleAppDeveloperModel.listSubmissions.mockResolvedValue({ items: [], nextCursor: null });
    mockModuleAppDeveloperModel.listVersions.mockResolvedValue([]);
    mockModuleAppDeveloperModel.rollbackVersion.mockResolvedValue({ ok: true });
    mockModuleAppDeveloperModel.setPublication.mockResolvedValue({ ok: true });
    mockModuleAppDeveloperModel.upsertPublisherProfile.mockResolvedValue({
      displayName: 'Developer',
      id: '00000000-0000-4000-8000-000000000050',
      status: 'pending',
    });
    mockEncryptInstallationSecret.mockReset().mockResolvedValue('encrypted-secret');
    mockModuleAppCommerceModel.listOrders.mockResolvedValue([]);
    mockModuleAppCommerceModel.listCatalog.mockResolvedValue([]);
    mockModuleAppCommerceModel.quoteProduct.mockResolvedValue({ price: 88 });
    mockModuleAppCommerceModel.createOrder.mockResolvedValue({ id: 'order-1', status: 'pending' });
    mockModuleAppCommerceModel.cancelOrder.mockResolvedValue({
      id: 'order-1',
      status: 'cancelled',
    });
    mockModuleAppCommerceModel.resolveLicense.mockResolvedValue(null);
    mockModuleAppCommerceModel.resolveEntitlementContext.mockResolvedValue({
      license: null,
      productType: undefined,
    });
    mockCreateModuleAppTextGenerator.mockReturnValue(mockTextGenerator);
    mockSignModuleAppCapability.mockReset();
    mockRuntimeClientInvoke.mockReset().mockResolvedValue({ output: { matches: [] } });
    mockRunModuleAppAction.mockReset().mockResolvedValue({
      artifactIds: [],
      billing: { chargedCredits: 0, fixedServiceFeeCharged: false },
      preview: 'Created',
      runId: 'run-1',
      status: 'succeeded',
    });
    mockIngestionService.issueUpload.mockResolvedValue({
      expiresAt: new Date('2026-07-11T02:00:00.000Z'),
      headers: { 'x-amz-acl': 'private' },
      storageKey:
        'module-app-packages/c6c289e49e9c05b2145860387b73bcb1/00000000-0000-4000-8000-000000000011.zip',
      uploadId: '00000000-0000-4000-8000-000000000010',
      uploadUrl: 'https://uploads.example.com/package.zip',
    });
    mockIngestionService.submitUpload.mockResolvedValue({
      id: 'package-1',
      reviewStatus: 'pending_review',
    });
    mockVerifyModuleAppCapability.mockResolvedValue({
      appId: APP_ID,
      aud: 'module-runtime',
      exp: 1_783_760_300,
      iat: 1_783_760_000,
      installationId: '00000000-0000-4000-8000-000000000010',
      nonce: '0123456789abcdef0123456789abcdef',
      permissions: ['context.read'],
      surface: 'browser',
      userId: 'user-1',
      versionId: '00000000-0000-4000-8000-000000000011',
    });
    mockModuleAppGateway.call.mockResolvedValue({ appId: APP_ID });
    mockModuleAppWorkflowModel.getRun.mockResolvedValue({
      id: 'workflow-run-1',
      status: 'running',
    });
    mockModuleAppWorkflowModel.listNodes.mockResolvedValue([
      { nodeKey: 'start', status: 'succeeded' },
    ]);
    mockModuleAppWorkflowModel.cancelRun.mockResolvedValue({
      id: 'workflow-run-1',
      status: 'cancelled',
    });
    mockModuleAppModel.getLaunchInstallationContext.mockReset().mockResolvedValue({
      actions: [],
      artifactKey: `module-app-builds/build/${'a'.repeat(64)}.tgz`,
      artifactSha256: 'a'.repeat(64),
      buildArtifactKey: `module-app-builds/build/${'a'.repeat(64)}.tgz`,
      buildArtifactSha256: 'a'.repeat(64),
      buildStatus: 'ready',
      displayName: 'Jobs Board',
      installationId: '00000000-0000-4000-8000-000000000010',
      publisherId: null,
      runtimeManifest: {
        build: { frontend: { output: 'dist', profile: 'node22-static' } },
        manifestVersion: 2,
        runtime: {
          functions: [],
          kind: 'sandboxed_app',
          outboundHosts: [],
          permissions: ['context.read'],
        },
      },
      versionId: '00000000-0000-4000-8000-000000000011',
      workspaceId: null,
    });
    mockSignModuleAppCapability.mockResolvedValue('signed-launch-capability');
  });

  it('registers the moduleApp router on lambda root', () => {
    expect(lambdaRouter._def.record.moduleApp).toBeDefined();
  });

  it('derives every developer operation from the authenticated user', async () => {
    const caller = createCaller();

    await caller.listMyDeveloperApps({});
    await caller.listMyDeveloperPayouts({});
    await caller.listMyDeveloperRevenue({});
    await caller.listMyDeveloperSubmissions({});
    await caller.publishMyDeveloperApp({ appId: APP_ID });
    await caller.upsertMyPublisherProfile({ displayName: 'Developer Studio' });

    expect(mockModuleAppDeveloperModel.listApplications).toHaveBeenCalledWith({
      cursor: 0,
      limit: 20,
      userId: 'user-1',
    });
    expect(mockModuleAppDeveloperModel.listPayouts).toHaveBeenCalledWith({
      cursor: 0,
      limit: 20,
      userId: 'user-1',
    });
    expect(mockModuleAppDeveloperModel.listRevenue).toHaveBeenCalledWith({
      cursor: 0,
      limit: 20,
      userId: 'user-1',
    });
    expect(mockModuleAppDeveloperModel.listSubmissions).toHaveBeenCalledWith({
      cursor: 0,
      limit: 20,
      userId: 'user-1',
    });
    expect(mockModuleAppDeveloperModel.setPublication).toHaveBeenCalledWith({
      appId: APP_ID,
      published: true,
      userId: 'user-1',
    });
    expect(mockModuleAppDeveloperModel.upsertPublisherProfile).toHaveBeenCalledWith('user-1', {
      displayName: 'Developer Studio',
    });
  });

  it('composes the root router exclusively from domain procedure records', () => {
    const domainRecords = [
      moduleAppMarketProcedures,
      moduleAppRuntimeProcedures,
      moduleAppDataProcedures,
      moduleAppDeveloperProcedures,
      moduleAppInstallationSecretProcedures,
      moduleAppWorkflowProcedures,
      moduleAppCommerceProcedures,
    ];
    const domainEntries = domainRecords.flatMap((record) => Object.entries(record));
    const domainKeys = domainEntries.map(([key]) => key);

    expect(new Set(domainKeys).size).toBe(domainKeys.length);
    expect(Object.keys(moduleAppProcedureRecord).sort()).toEqual(domainKeys.sort());
    for (const [key, procedure] of domainEntries) {
      expect(moduleAppProcedureRecord[key]).toBe(procedure);
    }
  });

  it('preserves the public Module App procedure contract', () => {
    const contract: Record<string, { inputs: number; type: 'mutation' | 'query' }> = {
      archiveRecord: { inputs: 1, type: 'mutation' },
      callSdk: { inputs: 1, type: 'mutation' },
      changeInstallationVersion: { inputs: 1, type: 'mutation' },
      cancelOrder: { inputs: 1, type: 'mutation' },
      cancelWorkflowRun: { inputs: 1, type: 'mutation' },
      createOrder: { inputs: 1, type: 'mutation' },
      createPackageUpload: { inputs: 1, type: 'mutation' },
      createPayment: { inputs: 1, type: 'mutation' },
      createRecord: { inputs: 1, type: 'mutation' },
      deleteInstallationSecret: { inputs: 1, type: 'mutation' },
      getDetail: { inputs: 1, type: 'query' },
      getLaunchContext: { inputs: 1, type: 'query' },
      getLicense: { inputs: 1, type: 'query' },
      getPaymentMethods: { inputs: 0, type: 'query' },
      getPaymentStatus: { inputs: 1, type: 'query' },
      getMyDeveloperFinance: { inputs: 0, type: 'query' },
      getMyDeveloperFinanceSummary: { inputs: 0, type: 'query' },
      getMyPublisherProfile: { inputs: 0, type: 'query' },
      getRecord: { inputs: 1, type: 'query' },
      getRuntimeManifest: { inputs: 1, type: 'query' },
      getWorkflowRun: { inputs: 1, type: 'query' },
      installPersonal: { inputs: 1, type: 'mutation' },
      installWorkspace: { inputs: 1, type: 'mutation' },
      listArtifacts: { inputs: 1, type: 'query' },
      listCatalog: { inputs: 1, type: 'query' },
      listInstallationSecrets: { inputs: 1, type: 'query' },
      listMarketplace: { inputs: 1, type: 'query' },
      listMyDeveloperApps: { inputs: 1, type: 'query' },
      listMyDeveloperPayouts: { inputs: 1, type: 'query' },
      listMyDeveloperRevenue: { inputs: 1, type: 'query' },
      listMyDeveloperSubmissions: { inputs: 1, type: 'query' },
      listMyDeveloperVersions: { inputs: 1, type: 'query' },
      listMobileApps: { inputs: 1, type: 'query' },
      listMyApps: { inputs: 1, type: 'query' },
      listMyPackageSubmissions: { inputs: 1, type: 'query' },
      listOrders: { inputs: 1, type: 'query' },
      listRecords: { inputs: 1, type: 'query' },
      listRuns: { inputs: 1, type: 'query' },
      listTeamApps: { inputs: 1, type: 'query' },
      listWorkflowNodes: { inputs: 1, type: 'query' },
      quoteProduct: { inputs: 1, type: 'query' },
      publishMyDeveloperApp: { inputs: 1, type: 'mutation' },
      rollbackMyDeveloperApp: { inputs: 1, type: 'mutation' },
      runAction: { inputs: 1, type: 'mutation' },
      submitUploadedPackage: { inputs: 1, type: 'mutation' },
      uninstallPersonal: { inputs: 1, type: 'mutation' },
      uninstallWorkspace: { inputs: 1, type: 'mutation' },
      unpublishMyDeveloperApp: { inputs: 1, type: 'mutation' },
      updateRecord: { inputs: 1, type: 'mutation' },
      upsertInstallationSecret: { inputs: 1, type: 'mutation' },
      upsertMyPublisherProfile: { inputs: 1, type: 'mutation' },
    };
    const inputSchemaContract: Record<string, null | string> = {
      archiveRecord: 'a5bdb0e9d08be4c8aec1ab63f7799506c2ae7da4e2d74eafec42b9331277c763',
      callSdk: 'f5f6172af0f33be5f6d0858876658ad5f32746f0617a62b90413eed4fc57720f',
      changeInstallationVersion: 'ae456d2d5e205358b561db305e880f7ec270248143dbc945b3b2ab00e5da079d',
      cancelOrder: 'fe711490d2ceed87cb98390a3bd76a74d924ba9c3b1c5a3d8cf45222a71597c2',
      cancelWorkflowRun: 'bc20752fff1ee9502b870951f737d082ae1b4b3324685ea975789775ebe68d80',
      createOrder: 'a77750111d36691a56d35663c7b3a5364e586a86fd8e276402236ba5752ab1b0',
      createPackageUpload: '2dc0265cf42f11400ba7c719729021b7acf0b47cd508353f8d505780eb523b0e',
      createPayment: 'd9f5254f1dfe54cc29aa901f3774e27744ad34d89fbc6cfdc4d52ab77a6bd44e',
      createRecord: '795662084260f4185fb50b4448b0ef5e99b8e83f49c0640d829c25b55578dc5d',
      deleteInstallationSecret: 'b543fe95fddae7a73ee56112f465caca7e7fd99cf1c4adeb490aa009cbc958c8',
      getDetail: 'c6181d288edb53cff19fde101dfd505082918d75601413541645de541da5a6f7',
      getLaunchContext: '00a65371494cfddaff03a3b1e8b6b851964cd5bc09f2f2f4bc61c25afea08200',
      getLicense: '00a65371494cfddaff03a3b1e8b6b851964cd5bc09f2f2f4bc61c25afea08200',
      getPaymentMethods: null,
      getPaymentStatus: 'fe711490d2ceed87cb98390a3bd76a74d924ba9c3b1c5a3d8cf45222a71597c2',
      getMyDeveloperFinance: null,
      getMyDeveloperFinanceSummary: null,
      getMyPublisherProfile: null,
      getRecord: 'a5bdb0e9d08be4c8aec1ab63f7799506c2ae7da4e2d74eafec42b9331277c763',
      getRuntimeManifest: '00a65371494cfddaff03a3b1e8b6b851964cd5bc09f2f2f4bc61c25afea08200',
      getWorkflowRun: 'bc20752fff1ee9502b870951f737d082ae1b4b3324685ea975789775ebe68d80',
      installPersonal: 'a530463f8f7699bcd593af39ca61ac5daeeaaee954aeb5f393280daa57acf5c5',
      installWorkspace: '5cfc644ff365215bd199e06f369fa744dc9159273e21affec61722b0ef255398',
      listArtifacts: 'e03f196872ccae1f68b6cfc3763e56ea12457d42e8a62cb89f9df8ba367739ea',
      listCatalog: '29a586026eb72026c0d46abbe8e1ebc1f53571d7bdc7eed7e436f1bee27c0614',
      listInstallationSecrets: '2a4ee71bedc82c90921be9f261cb67d48d9a3ba8ef447f53dfaab5f6e0764a96',
      listMarketplace: 'be2295a60051f9b0ac69157d1574fb2ed025528ca3c0c68f4941ff78b2775a36',
      listMyDeveloperApps: 'd55492ea7b2a3d42dfd716d07513bedc8b93c85c9fc16a6ae2855b22ca67b331',
      listMyDeveloperPayouts: 'd55492ea7b2a3d42dfd716d07513bedc8b93c85c9fc16a6ae2855b22ca67b331',
      listMyDeveloperRevenue: 'd55492ea7b2a3d42dfd716d07513bedc8b93c85c9fc16a6ae2855b22ca67b331',
      listMyDeveloperSubmissions:
        'd55492ea7b2a3d42dfd716d07513bedc8b93c85c9fc16a6ae2855b22ca67b331',
      listMyDeveloperVersions: '898fea177d3aa3758ccfc1e0405c10f8407660e85996bba8f333d4aa480e0030',
      listMobileApps: '3cc1cb6b55b5224b726b5d6d488b0c77f018faaabe59a832c8c47740907f2d37',
      listMyApps: 'ec614d5e71557596909d2d472085dc70994ea43b2959199a11e17bba1f1c3ed7',
      listMyPackageSubmissions: 'c950aa4ce80b261adbdd1b11c2a4f8b890c7a5169bb65cd736c70d5f7953d387',
      listOrders: '90eae46fff55349f39bc7aff0049837e19d4110a52193693722ebf2a1b3c8508',
      listRecords: '654ca57e0d4500fa0e8fedb3a05c28e4effc9e6cf77c1328e286cb572f52abd4',
      listRuns: 'e03f196872ccae1f68b6cfc3763e56ea12457d42e8a62cb89f9df8ba367739ea',
      listTeamApps: '3fd04226efa9c85b7e4cf51b12d6e755e8bc5d217b2237cd965658e3b367ca1e',
      listWorkflowNodes: 'bc20752fff1ee9502b870951f737d082ae1b4b3324685ea975789775ebe68d80',
      quoteProduct: 'a1853d54f05d51366ec02c149e42fa2b352b179da8f511a0bf1e4eddefa5c3c1',
      publishMyDeveloperApp: '898fea177d3aa3758ccfc1e0405c10f8407660e85996bba8f333d4aa480e0030',
      rollbackMyDeveloperApp: '5c742d4129cfc6389786050a9705e162342cf227f9a8c3a554a7793be9c6e0b0',
      runAction: '130d701a022b7b66f023bb29ce2700d3da14562b8517f00f6969693d34a4e7db',
      submitUploadedPackage: '8e0eef4a51d48655356cf4b396a0d0a4e90acd29f39bbcae7c16f81934c0b3d7',
      uninstallPersonal: 'a8393e9b9c81bbbd9ff38c6077dc9c298f47ec432ae845177119d32c1f0ea3e8',
      uninstallWorkspace: 'd4939cce108a95fbb53a358c8538c4d512fdbae2354c1467d9b63f6fbd0887dd',
      unpublishMyDeveloperApp: '898fea177d3aa3758ccfc1e0405c10f8407660e85996bba8f333d4aa480e0030',
      updateRecord: '0dbe4d35271edff71ef49bf389655d2b58d1bdc38f5e462095be5b43facf6d41',
      upsertInstallationSecret: 'f4ab655261b56c892510b4f00e2e9329ef619c330b04952af0728dcce8ff5441',
      upsertMyPublisherProfile: '23c2bfc737ff9f8ca13e95699a727f04e87e54e04dccfed8871672365cf5ec9b',
    };
    const baseMiddlewares = moduleAppProcedure._def.middlewares;
    const authMiddlewares = authedProcedure._def.middlewares;
    const databaseMiddlewares = serverDatabase._middlewares;

    expect(Object.keys(moduleAppProcedureRecord).sort()).toEqual(Object.keys(contract).sort());
    expect(Object.keys(inputSchemaContract).sort()).toEqual(Object.keys(contract).sort());
    expect(baseMiddlewares.slice(0, authMiddlewares.length)).toEqual(authMiddlewares);
    expect(
      baseMiddlewares.slice(
        authMiddlewares.length,
        authMiddlewares.length + databaseMiddlewares.length,
      ),
    ).toEqual(databaseMiddlewares);
    expect(baseMiddlewares).toHaveLength(authMiddlewares.length + databaseMiddlewares.length + 1);
    expect(fingerprintParser(z.string())).not.toBe(fingerprintParser(z.string().trim()));
    expect(fingerprintParser(z.string())).not.toBe(
      fingerprintParser(z.string().transform((value) => value.trim())),
    );
    const actualInputSchemaContract: Record<string, null | string> = {};
    for (const [key, expected] of Object.entries(contract)) {
      const procedure = moduleAppProcedureRecord[key];
      const middlewares = (procedure._def as typeof procedure._def & { middlewares: unknown[] })
        .middlewares;
      const input = procedure._def.inputs[0];
      const inputSchemaSha256 = input ? fingerprintParser(input as ZodTypeAny) : null;

      expect(procedure._def.type, key).toBe(expected.type);
      expect(procedure._def.inputs, key).toHaveLength(expected.inputs);
      actualInputSchemaContract[key] = inputSchemaSha256;
      expect(middlewares.slice(0, baseMiddlewares.length), key).toEqual(baseMiddlewares);
      expect(middlewares, key).toHaveLength(baseMiddlewares.length + expected.inputs + 1);
    }
    expect(actualInputSchemaContract).toEqual(inputSchemaContract);
  });

  describe('listMobileApps', () => {
    it('returns current-workspace installations before personal fallbacks and deduplicates apps', async () => {
      mockModuleAppModel.listInstalledApps.mockImplementation(
        async ({ scopeType }: { scopeType: 'personal' | 'workspace' }) =>
          scopeType === 'workspace'
            ? [
                { displayName: 'Workspace shared', id: 'shared' },
                { displayName: 'Workspace only', id: 'workspace-only' },
              ]
            : [
                { displayName: 'Personal shared', id: 'shared' },
                { displayName: 'Personal only', id: 'personal-only' },
              ],
      );

      await expect(createCaller().listMobileApps({ workspaceId: 'workspace-1' })).resolves.toEqual([
        {
          displayName: 'Workspace shared',
          id: 'shared',
          installationScope: 'workspace',
          workspaceId: 'workspace-1',
        },
        {
          displayName: 'Workspace only',
          id: 'workspace-only',
          installationScope: 'workspace',
          workspaceId: 'workspace-1',
        },
        {
          displayName: 'Personal only',
          id: 'personal-only',
          installationScope: 'personal',
        },
      ]);
      expect(mockGetWorkspaceMember).toHaveBeenCalledWith('workspace-1', 'user-1');
      expect(mockModuleAppModel.listInstalledApps).toHaveBeenCalledTimes(2);
    });

    it('returns only personal installations when there is no active workspace', async () => {
      mockModuleAppModel.listInstalledApps.mockResolvedValue([
        { displayName: 'Personal', id: 'personal' },
      ]);

      await expect(createCaller().listMobileApps({})).resolves.toEqual([
        {
          displayName: 'Personal',
          id: 'personal',
          installationScope: 'personal',
        },
      ]);
      expect(mockGetWorkspaceMember).not.toHaveBeenCalled();
      expect(mockModuleAppModel.listInstalledApps).toHaveBeenCalledTimes(1);
    });

    it('keeps the healthy scope when one installation query fails', async () => {
      mockModuleAppModel.listInstalledApps.mockImplementation(
        async ({ scopeType }: { scopeType: 'personal' | 'workspace' }) => {
          if (scopeType === 'workspace') throw new Error('workspace temporarily unavailable');
          return [{ displayName: 'Personal', id: 'personal' }];
        },
      );

      await expect(createCaller().listMobileApps({ workspaceId: 'workspace-1' })).resolves.toEqual([
        {
          displayName: 'Personal',
          id: 'personal',
          installationScope: 'personal',
        },
      ]);
    });
  });

  it('forwards paginated personal and team installation filters', async () => {
    mockModuleAppModel.listInstalledAppsPage
      .mockResolvedValueOnce({ items: [{ id: 'personal-app' }], nextCursor: 30 })
      .mockResolvedValueOnce({ items: [{ id: 'team-app' }], nextCursor: null });

    await expect(
      createCaller().listMyApps({ cursor: 20, limit: 10, query: 'desk' }),
    ).resolves.toEqual({ items: [{ id: 'personal-app' }], nextCursor: 30 });
    await expect(
      createCaller().listTeamApps({
        cursor: 0,
        limit: 20,
        query: 'shared',
        workspaceId: 'workspace-1',
      }),
    ).resolves.toEqual({ items: [{ id: 'team-app' }], nextCursor: null });
    expect(mockModuleAppModel.listInstalledAppsPage).toHaveBeenNthCalledWith(1, {
      cursor: 20,
      limit: 10,
      query: 'desk',
      scopeType: 'personal',
      userId: 'user-1',
    });
    expect(mockModuleAppModel.listInstalledAppsPage).toHaveBeenNthCalledWith(2, {
      cursor: 0,
      limit: 20,
      query: 'shared',
      scopeType: 'workspace',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
  });

  it('preserves the database, plan, model, and workflow-model context middleware', async () => {
    const database = {};
    mockGetServerDB.mockResolvedValueOnce(database);

    await expect(
      createCaller().getWorkflowRun({
        installationId: '00000000-0000-4000-8000-000000000010',
        runId: '00000000-0000-4000-8000-000000000012',
      }),
    ).resolves.toMatchObject({ id: 'workflow-run-1' });

    expect(mockGetServerDB).toHaveBeenCalledOnce();
    expect(mockGetSubscriptionPlan).toHaveBeenCalledWith(database, 'user-1');
    expect(mockModuleAppModel.assertInstallationAccess).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    );
    expect(mockModuleAppWorkflowModel.getRun).toHaveBeenCalledWith({
      installationId: '00000000-0000-4000-8000-000000000010',
      runId: '00000000-0000-4000-8000-000000000012',
    });
  });

  it('loads the runtime manifest from the scoped installation version', async () => {
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });
    mockModuleAppModel.getRuntimeManifest.mockResolvedValueOnce({
      actions: [],
      pages: [{ key: 'installed_page' }],
      version: '1.0.0',
    });

    await expect(
      createCaller().getRuntimeManifest({ appId: APP_ID, workspaceId: 'workspace-1' }),
    ).resolves.toMatchObject({
      pages: [{ key: 'installed_page' }],
      version: '1.0.0',
    });
    expect(mockModuleAppModel.getRuntimeManifest).toHaveBeenCalledWith({
      appId: APP_ID,
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
  });

  it('rejects public launch while general execution is disabled', async () => {
    mockAppEnv.MODULE_APP_EXECUTION_ENABLED = false;

    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'module_app_public_execution_disabled',
    });
    expect(mockRuntimeClientHealthCheck).not.toHaveBeenCalled();
    expect(mockSignModuleAppCapability).not.toHaveBeenCalled();
  });

  it('rejects public launch without an HTTPS runtime origin', async () => {
    mockAppEnv.MODULE_APP_RUNTIME_PUBLIC_ORIGIN = 'http://module-runtime.example.com';

    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'module_app_runtime_unavailable',
    });
    expect(mockSignModuleAppCapability).not.toHaveBeenCalled();
  });

  it('rejects public launch while the public execution rollout is disabled', async () => {
    mockAppEnv.MODULE_APP_PUBLIC_EXECUTION_ENABLED = false;

    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'module_app_public_execution_disabled',
    });
    expect(mockSignModuleAppCapability).not.toHaveBeenCalled();
  });

  it('rejects public launch while the configured runtime is not ready', async () => {
    mockRuntimeClientHealthCheck.mockResolvedValueOnce({
      code: 'MODULE_APP_RUNTIME_UNREACHABLE',
      status: 'unavailable',
    });

    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'module_app_runtime_unavailable',
    });
    expect(mockSignModuleAppCapability).not.toHaveBeenCalled();
  });

  it('rejects public launch outside the app and publisher rollout allowlists', async () => {
    mockAppEnv.MODULE_APP_RUNTIME_APP_ALLOWLIST = [];
    mockAppEnv.MODULE_APP_PUBLISHER_ALLOWLIST = [];
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });

    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'module_app_rollout_not_allowed',
    });
    expect(mockSignModuleAppCapability).not.toHaveBeenCalled();
  });

  it('rejects uninstalled and suspended applications', async () => {
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });
    mockModuleAppModel.getLaunchInstallationContext.mockResolvedValueOnce(null);
    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'module_app_installation_required',
    });

    mockModuleAppModel.getAppDetail.mockResolvedValueOnce(null);
    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('passes a live entitlement check into interactive actions', async () => {
    const action = {
      id: 'create_record',
      inputSchema: { fields: [] },
      moduleMultiplier: 1,
      name: 'Create',
      outputSchema: {},
      runtimeConfig: {},
      runtimeType: 'record_create',
    };
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [action],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });
    mockModuleAppModel.getLaunchInstallationContext.mockResolvedValue({
      actions: [action],
      artifactKey: `module-app-builds/build/${'a'.repeat(64)}.tgz`,
      artifactSha256: 'a'.repeat(64),
      buildArtifactKey: `module-app-builds/build/${'a'.repeat(64)}.tgz`,
      buildArtifactSha256: 'a'.repeat(64),
      buildStatus: 'ready',
      displayName: 'Jobs Board',
      installationId: '00000000-0000-4000-8000-000000000010',
      runtimeManifest: {
        build: { frontend: { output: 'dist', profile: 'node22-static' } },
        manifestVersion: 2,
        runtime: {
          functions: [],
          kind: 'sandboxed_app',
          outboundHosts: [],
          permissions: ['context.read'],
        },
      },
      versionId: '00000000-0000-4000-8000-000000000011',
      workspaceId: null,
    });
    mockModuleAppModel.createRecord.mockResolvedValue({ id: 'record-1' });

    await createCaller().runAction({
      actionId: 'create_record',
      appId: APP_ID,
      input: {},
      scopeType: 'personal',
    });

    expect(mockRunModuleAppAction).toHaveBeenCalledWith(
      expect.objectContaining({
        assertEntitlement: expect.any(Function),
        textGenerator: mockTextGenerator,
      }),
    );
    expect(mockCreateModuleAppTextGenerator).toHaveBeenCalledWith({
      db: {},
      workspaceId: undefined,
    });
    const [{ assertEntitlement }] = mockRunModuleAppAction.mock.calls.at(-1)!;
    await expect(assertEntitlement()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'plan_run_denied',
    });
    expect(mockModuleAppModel.getAppDetail).toHaveBeenCalledTimes(2);
  });

  it('filters marketplace candidates through the central visibility decision', async () => {
    mockModuleAppModel.listMarketplaceApps.mockResolvedValueOnce([
      {
        id: APP_ID,
        installed: true,
        planState: { installable: true, runnable: true, visible: true },
        status: 'published',
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        planState: { installable: false, runnable: false, visible: false },
        status: 'published',
      },
    ]);
    mockModuleAppModel.listInstalledApps.mockResolvedValueOnce([
      {
        id: APP_ID,
        installedVersion: { id: 'version-1', version: '1.0.0' },
        installationReadiness: {
          configuration: 'required',
          missingSecretCount: 1,
          runtime: 'ready',
        },
        publishedVersion: { id: 'version-2', version: '2.0.0' },
        updateAvailable: true,
      },
    ]);

    await expect(createCaller().listMarketplace({})).resolves.toEqual([
      expect.objectContaining({
        id: APP_ID,
        installed: true,
        installedVersion: { id: 'version-1', version: '1.0.0' },
        installationReadiness: {
          configuration: 'required',
          missingSecretCount: 1,
          runtime: 'ready',
        },
        updateAvailable: true,
      }),
    ]);
    expect(mockModuleAppModel.listMarketplaceApps).toHaveBeenCalledWith(
      expect.objectContaining({ includeHidden: true, plan: 'free', userId: 'user-1' }),
    );
    expect(mockModuleAppModel.listInstalledApps).toHaveBeenCalledWith({
      scopeType: 'personal',
      userId: 'user-1',
    });
  });

  it('uses the central install decision before creating an installation', async () => {
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      id: APP_ID,
      planState: { installable: false, runnable: false, visible: true },
      status: 'published',
    });

    await expect(createCaller().installPersonal({ appId: APP_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'plan_install_denied',
    });
    expect(mockModuleAppModel.installPersonalApp).not.toHaveBeenCalled();
  });

  it('resolves workspace detail and installs or uninstalls only for a current member', async () => {
    const workspaceId = 'workspace-1';

    await expect(
      createCaller().getDetail({ appIdOrSlug: APP_ID, workspaceId }),
    ).resolves.toMatchObject({
      canManageInstallationSecrets: true,
      id: APP_ID,
    });
    expect(mockModuleAppModel.getAppDetail).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId }),
    );

    await expect(createCaller().installWorkspace({ appId: APP_ID, workspaceId })).resolves.toEqual({
      ok: true,
    });
    expect(mockModuleAppModel.installWorkspaceApp).toHaveBeenCalledWith({
      appId: APP_ID,
      userId: 'user-1',
      workspaceId,
    });

    await expect(
      createCaller().uninstallWorkspace({ appId: APP_ID, workspaceId }),
    ).resolves.toEqual({
      ok: true,
    });
    expect(mockModuleAppModel.uninstallWorkspaceApp).toHaveBeenCalledWith({
      appId: APP_ID,
      dataPolicy: 'retain',
      workspaceId,
    });

    mockGetWorkspaceMember.mockResolvedValueOnce(null);
    await expect(
      createCaller().installWorkspace({ appId: APP_ID, workspaceId: 'workspace-denied' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'module_app_workspace_denied' });
  });

  it('returns scoped version state and performs an optimistic workspace upgrade', async () => {
    const workspaceId = 'workspace-1';
    const expectedVersionId = '00000000-0000-4000-8000-000000000002';
    const versionId = '00000000-0000-4000-8000-000000000003';
    mockModuleAppModel.getAppDetail.mockResolvedValue({
      id: APP_ID,
      installed: true,
      planState: { installable: true, runnable: true, visible: true },
    });
    mockModuleAppModel.getInstallationVersionState.mockResolvedValue({
      installationReadiness: {
        configuration: 'required',
        missingSecretCount: 1,
        runtime: 'ready',
      },
      installedVersion: { id: expectedVersionId, version: '1.0.0' },
      rollbackVersions: [],
      updateAvailable: true,
    });
    mockModuleAppModel.changeInstallationVersion.mockResolvedValue({
      changed: true,
      installationId: 'installation-1',
      operation: 'upgrade',
      previousVersionId: expectedVersionId,
      versionId,
    });

    await expect(
      createCaller().getDetail({ appIdOrSlug: APP_ID, workspaceId }),
    ).resolves.toMatchObject({
      canManageInstallation: true,
      installationReadiness: {
        configuration: 'required',
        missingSecretCount: 1,
        runtime: 'ready',
      },
      installedVersion: { id: expectedVersionId, version: '1.0.0' },
      updateAvailable: true,
    });
    expect(mockModuleAppModel.getInstallationVersionState).toHaveBeenCalledWith({
      appId: APP_ID,
      userId: 'user-1',
      workspaceId,
    });

    await expect(
      createCaller().changeInstallationVersion({
        appId: APP_ID,
        expectedVersionId,
        operation: 'upgrade',
        workspaceId,
      }),
    ).resolves.toMatchObject({ changed: true, versionId });
    expect(mockModuleAppModel.changeInstallationVersion).toHaveBeenCalledWith({
      appId: APP_ID,
      expectedVersionId,
      operation: 'upgrade',
      scopeType: 'workspace',
      userId: 'user-1',
      workspaceId,
    });
  });

  it('maps stale installation version changes to a conflict', async () => {
    mockModuleAppModel.changeInstallationVersion.mockRejectedValueOnce(
      new Error('MODULE_APP_INSTALLATION_VERSION_CONFLICT'),
    );

    await expect(
      createCaller().changeInstallationVersion({
        appId: APP_ID,
        expectedVersionId: '00000000-0000-4000-8000-000000000002',
        operation: 'upgrade',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'MODULE_APP_INSTALLATION_VERSION_CONFLICT',
    });
  });

  it.each([
    ['MODULE_APP_NOT_FOUND', 'NOT_FOUND'],
    ['MODULE_APP_NOT_INSTALLABLE', 'PRECONDITION_FAILED'],
  ] as const)('maps installation version error %s to %s', async (message, code) => {
    mockModuleAppModel.changeInstallationVersion.mockRejectedValueOnce(new Error(message));

    await expect(
      createCaller().changeInstallationVersion({
        appId: APP_ID,
        expectedVersionId: '00000000-0000-4000-8000-000000000002',
        operation: 'upgrade',
      }),
    ).rejects.toMatchObject({ code, message });
  });

  it('rejects workspace purchase, install, and uninstall mutations from regular members', async () => {
    const workspaceId = 'workspace-1';
    const productId = '00000000-0000-4000-8000-000000000031';
    const idempotencyKey = '00000000-0000-4000-8000-000000000032';
    mockGetWorkspaceMember.mockResolvedValue({ role: 'member', workspaceId });

    await expect(
      createCaller().createOrder({ idempotencyKey, productId, workspaceId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'workspace_admin_required' });
    await expect(
      createCaller().installWorkspace({ appId: APP_ID, workspaceId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'workspace_admin_required' });
    await expect(
      createCaller().uninstallWorkspace({ appId: APP_ID, workspaceId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'workspace_admin_required' });
    await expect(
      createCaller().changeInstallationVersion({
        appId: APP_ID,
        expectedVersionId: '00000000-0000-4000-8000-000000000002',
        operation: 'upgrade',
        workspaceId,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'workspace_admin_required' });
    expect(mockModuleAppCommerceModel.createOrder).not.toHaveBeenCalled();
    expect(mockModuleAppModel.changeInstallationVersion).not.toHaveBeenCalled();
    expect(mockModuleAppModel.installWorkspaceApp).not.toHaveBeenCalled();
    expect(mockModuleAppModel.uninstallWorkspaceApp).not.toHaveBeenCalled();
  });

  it('keeps shared installation credentials read-only for regular workspace members', async () => {
    mockGetWorkspaceMember.mockResolvedValue({ role: 'member', workspaceId: 'workspace-1' });

    await expect(
      createCaller().getDetail({ appIdOrSlug: APP_ID, workspaceId: 'workspace-1' }),
    ).resolves.toMatchObject({
      canManageInstallation: false,
      canManageInstallationSecrets: false,
      id: APP_ID,
    });
  });

  it('encrypts and manages personal installation secrets without returning secret values', async () => {
    const installationId = '00000000-0000-4000-8000-000000000010';
    const caller = createCaller() as any;
    mockModuleAppModel.getInstallationSecretState.mockResolvedValue({
      items: [
        {
          createdAt: new Date('2026-07-26T00:00:00.000Z'),
          secretKey: 'CRM_TOKEN',
          updatedAt: new Date('2026-07-26T00:00:00.000Z'),
        },
      ],
      missingKeys: ['API_KEY'],
      ready: false,
      requiredKeys: ['API_KEY', 'CRM_TOKEN'],
    });

    await expect(caller.listInstallationSecrets({ installationId })).resolves.toMatchObject({
      items: [expect.objectContaining({ secretKey: 'CRM_TOKEN' })],
      missingKeys: ['API_KEY'],
      ready: false,
      requiredKeys: ['API_KEY', 'CRM_TOKEN'],
    });
    await expect(
      caller.upsertInstallationSecret({
        installationId,
        secretKey: 'CRM_TOKEN',
        value: 'plain-secret',
      }),
    ).resolves.toEqual({ ok: true });
    expect(mockEncryptInstallationSecret).toHaveBeenCalledWith('plain-secret');
    expect(mockModuleAppModel.upsertInstallationSecret).toHaveBeenCalledWith({
      createdBy: 'user-1',
      encryptedValue: 'encrypted-secret',
      installationId,
      secretKey: 'CRM_TOKEN',
    });
    await expect(
      caller.deleteInstallationSecret({ installationId, secretKey: 'CRM_TOKEN' }),
    ).resolves.toEqual({ ok: true });
    expect(mockModuleAppModel.assertInstallationAccess).toHaveBeenCalledWith({
      installationId,
      userId: 'user-1',
      workspaceId: undefined,
    });
  });

  it('maps undeclared installation secret writes to a client error', async () => {
    const installationId = '00000000-0000-4000-8000-000000000010';
    mockModuleAppModel.upsertInstallationSecret.mockRejectedValueOnce(
      new Error('MODULE_APP_SECRET_NOT_DECLARED'),
    );

    await expect(
      createCaller().upsertInstallationSecret({
        installationId,
        secretKey: 'UNDECLARED_TOKEN',
        value: 'plain-secret',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'MODULE_APP_SECRET_NOT_DECLARED' });
  });

  it('allows only workspace owners and admins to manage shared installation secrets', async () => {
    const input = {
      installationId: '00000000-0000-4000-8000-000000000010',
      secretKey: 'CRM_TOKEN',
      value: 'plain-secret',
      workspaceId: 'workspace-1',
    };
    const caller = createCaller() as any;
    mockGetWorkspaceMember.mockResolvedValueOnce({ role: 'member', workspaceId: 'workspace-1' });

    await expect(caller.upsertInstallationSecret(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'workspace_admin_required',
    });
    expect(mockEncryptInstallationSecret).not.toHaveBeenCalled();

    mockGetWorkspaceMember.mockResolvedValueOnce({ role: 'admin', workspaceId: 'workspace-1' });
    await expect(caller.upsertInstallationSecret(input)).resolves.toEqual({ ok: true });
    expect(mockModuleAppModel.assertInstallationAccess).toHaveBeenCalledWith({
      installationId: input.installationId,
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
  });

  it('rechecks runnable plan entitlement before launch', async () => {
    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toThrow(
      'plan_run_denied',
    );
    expect(mockModuleAppModel.getLaunchInstallationContext).not.toHaveBeenCalled();
  });

  it('rejects a workspace launch when the user is not a current member', async () => {
    mockGetWorkspaceMember.mockResolvedValueOnce(null);

    await expect(
      createCaller().getLaunchContext({ appId: APP_ID, workspaceId: 'workspace-1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'module_app_workspace_denied' });
    expect(mockSignModuleAppCapability).not.toHaveBeenCalled();
  });

  it('rejects an installation whose immutable build is not ready', async () => {
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });
    mockModuleAppModel.getLaunchInstallationContext.mockResolvedValueOnce({
      artifactSha256: null,
      buildArtifactSha256: null,
      buildStatus: 'building',
      displayName: 'Jobs Board',
      installationId: '00000000-0000-4000-8000-000000000010',
      runtimeManifest: {},
      versionId: '00000000-0000-4000-8000-000000000011',
      workspaceId: null,
    });

    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'module_app_build_not_ready',
    });
    expect(mockSignModuleAppCapability).not.toHaveBeenCalled();
  });

  it('verifies and delegates a browser capability gateway call', async () => {
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });

    await expect(
      createCaller().callSdk({
        capability: 'signed-capability',
        input: {},
        method: 'context.get',
        requestId: 'request-1',
      }),
    ).resolves.toEqual({ appId: APP_ID });

    expect(mockVerifyModuleAppCapability).toHaveBeenCalledWith('signed-capability', {
      userId: 'user-1',
    });
    expect(mockModuleAppGateway.call).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'context.get', requestId: 'request-1' }),
    );
  });

  it('rejects browser capability gateway calls while general execution is disabled', async () => {
    mockAppEnv.MODULE_APP_EXECUTION_ENABLED = false;

    await expect(
      createCaller().callSdk({
        capability: 'signed-capability',
        input: {},
        method: 'context.get',
      }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'module_app_runtime_unavailable',
    });

    expect(mockVerifyModuleAppCapability).not.toHaveBeenCalled();
    expect(mockModuleAppGateway.call).not.toHaveBeenCalled();
  });

  it('accepts managed data gateway methods', async () => {
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });
    mockModuleAppGateway.call.mockResolvedValueOnce({ items: [], nextCursor: null });

    await expect(
      createCaller().callSdk({
        capability: 'signed-capability',
        input: { tableKey: 'candidates' },
        method: 'data.list',
      }),
    ).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('maps managed data validation errors to bad requests', async () => {
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });
    mockModuleAppGateway.call.mockRejectedValueOnce(new Error('MODULE_APP_DATA_SCHEMA_INVALID'));

    await expect(
      createCaller().callSdk({
        capability: 'signed-capability',
        input: { tableKey: 'candidates' },
        method: 'data.list',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rechecks the current plan before a browser capability gateway call', async () => {
    await expect(
      createCaller().callSdk({
        capability: 'signed-capability',
        input: {},
        method: 'context.get',
      }),
    ).rejects.toThrow('plan_run_denied');
    expect(mockModuleAppGateway.call).not.toHaveBeenCalled();
  });

  it('rejects runtime capabilities from the user-facing gateway route', async () => {
    mockVerifyModuleAppCapability.mockResolvedValueOnce({
      appId: APP_ID,
      aud: 'module-runtime',
      exp: 1_783_760_300,
      iat: 1_783_760_000,
      installationId: '00000000-0000-4000-8000-000000000010',
      nonce: '0123456789abcdef0123456789abcdef',
      permissions: ['secrets.read'],
      surface: 'runtime',
      userId: 'user-1',
      versionId: '00000000-0000-4000-8000-000000000011',
    });

    await expect(
      createCaller().callSdk({
        capability: 'runtime-capability',
        input: { key: 'CRM_TOKEN' },
        method: 'secrets.get',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockModuleAppGateway.call).not.toHaveBeenCalled();
  });

  it('rejects team artifact history when workspace membership is missing', async () => {
    mockGetWorkspaceMember.mockResolvedValueOnce(null);
    await expect(
      createCaller().listArtifacts({
        installationId: '00000000-0000-4000-8000-000000000010',
        workspaceId: 'workspace-denied',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockModuleAppModel.listArtifacts).not.toHaveBeenCalled();
  });

  it('returns persisted workflow state only after installation authorization', async () => {
    const input = {
      installationId: '00000000-0000-4000-8000-000000000010',
      runId: '00000000-0000-4000-8000-000000000020',
    };

    await expect(createCaller().getWorkflowRun(input)).resolves.toMatchObject({
      status: 'running',
    });
    await expect(createCaller().listWorkflowNodes(input)).resolves.toEqual([
      { nodeKey: 'start', status: 'succeeded' },
    ]);

    expect(mockModuleAppModel.assertInstallationAccess).toHaveBeenCalledWith({
      installationId: input.installationId,
      userId: 'user-1',
      workspaceId: undefined,
    });
    expect(mockModuleAppWorkflowModel.getRun).toHaveBeenCalledWith(input);
    expect(mockModuleAppWorkflowModel.listNodes).toHaveBeenCalledWith(input);
  });

  it('cancels a workflow only through an explicit authorized mutation', async () => {
    const input = {
      installationId: '00000000-0000-4000-8000-000000000010',
      runId: '00000000-0000-4000-8000-000000000020',
      workspaceId: 'workspace-1',
    };

    await expect(createCaller().cancelWorkflowRun(input)).resolves.toMatchObject({
      status: 'cancelled',
    });

    expect(mockGetWorkspaceMember).toHaveBeenCalled();
    expect(mockModuleAppWorkflowModel.cancelRun).toHaveBeenCalledWith({
      installationId: input.installationId,
      runId: input.runId,
    });
  });

  it('does not misreport unexpected workflow cancellation failures as conflicts', async () => {
    mockModuleAppWorkflowModel.cancelRun.mockRejectedValueOnce(new Error('DATABASE_UNAVAILABLE'));

    await expect(
      createCaller().cancelWorkflowRun({
        installationId: '00000000-0000-4000-8000-000000000010',
        runId: '00000000-0000-4000-8000-000000000020',
      }),
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
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

  it.each([
    'none',
    'record_create',
    'record_update',
    'record_archive',
    'api_action',
    'server_action',
    'content_generation',
    'workflow_step',
    'executable_action',
  ] as const)('rejects %s actions while general execution is disabled', async (runtimeType) => {
    mockAppEnv.MODULE_APP_EXECUTION_ENABLED = false;

    await expect(
      createCaller().runAction({
        actionId: `${runtimeType}_action`,
        appId: APP_ID,
        input: {},
        scopeType: 'personal',
      }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'module_app_runtime_unavailable',
    });
    expect(mockModuleAppModel.getAppDetail).not.toHaveBeenCalled();
    expect(mockRunModuleAppAction).not.toHaveBeenCalled();
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
    mockModuleAppModel.getLaunchInstallationContext.mockResolvedValue({
      actions: [action],
      artifactKey: `module-app-builds/build/${'a'.repeat(64)}.tgz`,
      artifactSha256: 'a'.repeat(64),
      buildArtifactKey: `module-app-builds/build/${'a'.repeat(64)}.tgz`,
      buildArtifactSha256: 'a'.repeat(64),
      buildStatus: 'ready',
      displayName: 'Jobs Board',
      installationId: '00000000-0000-4000-8000-000000000010',
      runtimeManifest: {
        build: { frontend: { output: 'dist', profile: 'node22-static' } },
        manifestVersion: 2,
        runtime: {
          functions: [],
          kind: 'sandboxed_app',
          outboundHosts: [],
          permissions: ['context.read'],
        },
      },
      versionId: '00000000-0000-4000-8000-000000000011',
      workspaceId: null,
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

  it('builds executable action invocations only from the installed version snapshot', async () => {
    const installedAction = {
      id: 'search',
      inputSchema: { fields: [] },
      moduleMultiplier: 1,
      name: 'Search',
      outputSchema: {},
      runtimeConfig: { functionKey: 'search_jobs', timeoutMs: 12_000 },
      runtimeType: 'executable_action',
    };
    mockModuleAppModel.getAppDetail.mockResolvedValue({
      actions: [
        {
          ...installedAction,
          runtimeConfig: {},
          runtimeType: 'record_create',
        },
      ],
      id: APP_ID,
      installed: true,
      planState: { installable: true, runnable: true, visible: true },
      status: 'published',
    });
    mockModuleAppModel.getLaunchInstallationContext.mockResolvedValue({
      actions: [installedAction],
      artifactKey: 'module-app-builds/build-1/' + 'a'.repeat(64) + '.tgz',
      artifactSha256: 'a'.repeat(64),
      buildArtifactKey: 'module-app-builds/build-1/' + 'a'.repeat(64) + '.tgz',
      buildArtifactSha256: 'a'.repeat(64),
      buildStatus: 'ready',
      displayName: 'Search App',
      installationId: '00000000-0000-4000-8000-000000000010',
      runtimeManifest: {
        build: { frontend: { output: 'dist', profile: 'node22-static' } },
        manifestVersion: 2,
        runtime: {
          functions: [{ entry: 'server/search.js', key: 'search_jobs', runtime: 'node22' }],
          kind: 'sandboxed_app',
          outboundHosts: [],
          permissions: ['data.read'],
        },
      },
      versionId: '00000000-0000-4000-8000-000000000011',
      workspaceId: null,
    });
    mockSignModuleAppCapability.mockResolvedValue('runtime-capability');
    mockRunModuleAppAction.mockImplementation(async (input) => ({
      ...(await input.runner()),
      runId: 'run-1',
      status: 'succeeded',
    }));

    mockAppEnv.MODULE_APP_RUNTIME_INVOCATION_ENABLED = false;
    await expect(
      createCaller().runAction({
        actionId: 'search',
        appId: APP_ID,
        input: { query: 'jobs' },
        scopeType: 'personal',
      }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'module_app_runtime_invocation_disabled',
    });
    expect(mockRuntimeClientInvoke).not.toHaveBeenCalled();

    mockAppEnv.MODULE_APP_RUNTIME_INVOCATION_ENABLED = true;

    await expect(
      createCaller().runAction({
        actionId: 'search',
        appId: APP_ID,
        input: { query: 'jobs' },
        scopeType: 'personal',
      }),
    ).resolves.toMatchObject({ runId: 'run-1', status: 'succeeded' });

    expect(mockSignModuleAppCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: APP_ID,
        artifactSha256: 'a'.repeat(64),
        installationId: '00000000-0000-4000-8000-000000000010',
        surface: 'runtime',
        versionId: '00000000-0000-4000-8000-000000000011',
      }),
      expect.objectContaining({ expiresInSeconds: 300 }),
    );
    expect(mockRuntimeClientInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactSha256: 'a'.repeat(64),
        capability: 'runtime-capability',
        entry: 'server/search.js',
        input: { query: 'jobs' },
        runtime: 'node22',
        timeoutMs: 12_000,
      }),
    );
  });

  it.each(['record_create', 'api_action', 'content_generation'] as const)(
    'does not invoke the runtime client for %s',
    async (runtimeType) => {
      const action = {
        id: 'regular_action',
        inputSchema: { fields: [] },
        moduleMultiplier: 1,
        name: 'Regular action',
        outputSchema: {},
        runtimeConfig: {},
        runtimeType,
      };
      mockModuleAppModel.getAppDetail.mockResolvedValue({
        actions: [action],
        id: APP_ID,
        planState: { installable: true, runnable: true, visible: true },
      });
      mockModuleAppModel.getLaunchInstallationContext.mockResolvedValue({
        actions: [action],
        artifactKey: `module-app-builds/build/${'a'.repeat(64)}.tgz`,
        artifactSha256: 'a'.repeat(64),
        buildArtifactKey: `module-app-builds/build/${'a'.repeat(64)}.tgz`,
        buildArtifactSha256: 'a'.repeat(64),
        buildStatus: 'ready',
        displayName: 'Jobs Board',
        installationId: '00000000-0000-4000-8000-000000000010',
        runtimeManifest: {
          build: { frontend: { output: 'dist', profile: 'node22-static' } },
          manifestVersion: 2,
          runtime: {
            functions: [],
            kind: 'sandboxed_app',
            outboundHosts: [],
            permissions: [],
          },
        },
        versionId: '00000000-0000-4000-8000-000000000011',
        workspaceId: null,
      });

      await createCaller().runAction({
        actionId: action.id,
        appId: APP_ID,
        input: {},
        scopeType: 'personal',
      });

      expect(mockRuntimeClientInvoke).not.toHaveBeenCalled();
    },
  );

  it('delegates package upload issuance to the durable ingestion service', async () => {
    const caller = createCaller();
    const target = await caller.createPackageUpload({
      fileName: 'package-app.zip',
      mimeType: 'application/zip',
      sizeBytes: 256,
    });

    expect(target).toMatchObject({
      expiresAt: new Date('2026-07-11T02:00:00.000Z'),
      headers: { 'x-amz-acl': 'private' },
      storageKey:
        'module-app-packages/c6c289e49e9c05b2145860387b73bcb1/00000000-0000-4000-8000-000000000011.zip',
      uploadId: '00000000-0000-4000-8000-000000000010',
      uploadUrl: 'https://uploads.example.com/package.zip',
    });
    expect(mockIngestionService.issueUpload).toHaveBeenCalledWith({
      input: {
        fileName: 'package-app.zip',
        mimeType: 'application/zip',
        sizeBytes: 256,
      },
      userId: 'user-1',
    });
  });

  it('delegates uploaded package submission with the durable upload identity', async () => {
    const input = {
      fileName: 'package-app.zip',
      storageKey:
        'module-app-packages/c6c289e49e9c05b2145860387b73bcb1/00000000-0000-4000-8000-000000000011.zip',
      uploadId: '00000000-0000-4000-8000-000000000010',
    };

    await expect(createCaller().submitUploadedPackage(input)).resolves.toEqual({
      id: 'package-1',
      reviewStatus: 'pending_review',
    });

    expect(mockIngestionService.submitUpload).toHaveBeenCalledWith({ input, userId: 'user-1' });
  });

  it.each([
    ['MODULE_APP_PACKAGE_OPEN_UPLOAD_LIMIT', 'TOO_MANY_REQUESTS'],
    ['MODULE_APP_PACKAGE_STORAGE_QUOTA_EXCEEDED', 'FORBIDDEN'],
    ['MODULE_APP_PACKAGE_UPLOAD_CONFLICT', 'CONFLICT'],
    ['MODULE_APP_PACKAGE_UPLOAD_EXPIRED', 'BAD_REQUEST'],
  ])('maps ingestion error %s to tRPC code %s', async (message, code) => {
    mockIngestionService.issueUpload.mockRejectedValueOnce(new Error(message));

    await expect(
      createCaller().createPackageUpload({
        fileName: 'package-app.zip',
        mimeType: 'application/zip',
        sizeBytes: 256,
      }),
    ).rejects.toMatchObject({ code, message });
  });

  it('lists only the current user package submissions without exposing storage keys', async () => {
    mockModuleAppModel.listAdminPackageSubmissions.mockResolvedValue({
      items: [
        {
          appId: null,
          archive: {
            fileName: 'classified-info.zip',
            mimeType: 'application/zip',
            sha256: 'a'.repeat(64),
            sizeBytes: 1024,
            storageKey: 'module-app-packages/private/package.zip',
          },
          createdAt: new Date('2026-07-10T00:00:00.000Z'),
          id: 'package-1',
          manifestSnapshot: {
            app: { displayName: 'Classified Info', slug: 'classified-info' },
            packageVersion: '1.2.0',
          },
          publishedAt: null,
          rejectionReason: null,
          reviewedAt: null,
          reviewStatus: 'pending_review',
          updatedAt: new Date('2026-07-10T00:00:00.000Z'),
        },
      ],
      nextCursor: null,
    });

    const result = await createCaller().listMyPackageSubmissions({
      cursor: 0,
      limit: 20,
    });

    expect(mockModuleAppModel.listAdminPackageSubmissions).toHaveBeenCalledWith({
      cursor: 0,
      limit: 20,
      reviewStatus: undefined,
      submittedByUserId: 'user-1',
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          appDisplayName: 'Classified Info',
          appSlug: 'classified-info',
          fileName: 'classified-info.zip',
          id: 'package-1',
          packageVersion: '1.2.0',
          reviewStatus: 'pending_review',
          sizeBytes: 1024,
        }),
      ],
      nextCursor: null,
    });
    expect(result.items[0]).not.toHaveProperty('archive');
    expect(result.items[0]).not.toHaveProperty('manifestSnapshot');
    expect(result.items[0]).not.toHaveProperty('storageKey');
  });

  it('skips malformed package submissions without failing the current user list', async () => {
    mockModuleAppModel.listAdminPackageSubmissions.mockResolvedValue({
      items: [
        {
          appId: null,
          archive: {
            fileName: 'classified-info.zip',
            mimeType: 'application/zip',
            sha256: 'a'.repeat(64),
            sizeBytes: 1024,
            storageKey: 'module-app-packages/private/package.zip',
          },
          createdAt: new Date('2026-07-10T00:00:00.000Z'),
          id: 'package-valid',
          manifestSnapshot: {
            app: { displayName: 'Classified Info', slug: 'classified-info' },
            packageVersion: '1.2.0',
          },
          publishedAt: null,
          rejectionReason: null,
          reviewedAt: null,
          reviewStatus: 'pending_review',
          updatedAt: new Date('2026-07-10T00:00:00.000Z'),
        },
        {
          appId: null,
          archive: { storageKey: 'module-app-packages/private/malformed.zip' },
          createdAt: new Date('2026-07-10T00:00:00.000Z'),
          id: 'package-malformed',
          manifestSnapshot: null,
          publishedAt: null,
          rejectionReason: null,
          reviewedAt: null,
          reviewStatus: 'pending_review',
          updatedAt: new Date('2026-07-10T00:00:00.000Z'),
        },
      ],
      nextCursor: null,
    });

    const result = await createCaller().listMyPackageSubmissions({
      cursor: 0,
      limit: 20,
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        appDisplayName: 'Classified Info',
        id: 'package-valid',
      }),
    ]);
    expect(result.items[0]).not.toHaveProperty('archive');
    expect(result.items[0]).not.toHaveProperty('manifestSnapshot');
    expect(result.items[0]).not.toHaveProperty('storageKey');
  });

  it('lists only orders owned by the authenticated user', async () => {
    mockModuleAppCommerceModel.listOrders.mockResolvedValueOnce([{ id: 'order-1' }]);

    await expect(createCaller().listOrders({ limit: 20 })).resolves.toEqual([{ id: 'order-1' }]);
    expect(mockModuleAppCommerceModel.listOrders).toHaveBeenCalledWith({
      limit: 20,
      purchaserUserId: 'user-1',
    });
  });

  it('resolves a personal license for the authenticated user only', async () => {
    mockModuleAppCommerceModel.resolveLicense.mockResolvedValueOnce({ id: 'license-1' });

    await expect(createCaller().getLicense({ appId: APP_ID })).resolves.toEqual({
      id: 'license-1',
    });
    expect(mockModuleAppCommerceModel.resolveLicense).toHaveBeenCalledWith({
      appId: APP_ID,
      userId: 'user-1',
    });
  });

  it('quotes and creates an order from server catalog data for the authenticated user', async () => {
    const productId = '00000000-0000-4000-8000-000000000031';
    const idempotencyKey = '00000000-0000-4000-8000-000000000032';
    await expect(createCaller().quoteProduct({ productId })).resolves.toEqual({ price: 88 });
    await expect(createCaller().createOrder({ idempotencyKey, productId })).resolves.toMatchObject({
      status: 'pending',
    });
    expect(mockModuleAppCommerceModel.quoteProduct).toHaveBeenCalledWith({ productId });
    expect(mockModuleAppCommerceModel.createOrder).toHaveBeenCalledWith({
      idempotencyKey,
      productId,
      purchaserUserId: 'user-1',
    });
  });

  it('keeps module checkout disabled until unified payments are enabled', async () => {
    mockGetServerPaymentConfig.mockResolvedValue({
      enabled: true,
      moduleAppEnabled: false,
      publicBaseUrl: 'https://app.example.com',
    });
    await expect(
      createCaller().createPayment({
        orderId: '00000000-0000-4000-8000-000000000021',
      }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'module_app_payment_disabled',
    });
    expect(mockModuleAppPaymentService.createPayment).not.toHaveBeenCalled();
  });

  it('creates checkout from server-owned payment data and strips a legacy client subject', async () => {
    mockGetServerPaymentConfig.mockResolvedValue({
      enabled: true,
      moduleAppEnabled: true,
      publicBaseUrl: 'https://app.example.com',
    });
    const orderId = '00000000-0000-4000-8000-000000000021';

    await expect(
      createCaller().createPayment({ orderId, subject: 'Client-controlled title' } as never),
    ).resolves.toMatchObject({ outTradeNo: 'out-1' });
    expect(mockModuleAppPaymentService.createPayment).toHaveBeenCalledWith({
      notifyUrl: 'https://app.example.com/api/webhooks/payments/alipay',
      orderId,
      purchaserUserId: 'user-1',
      returnUrl: 'https://app.example.com/apps',
      rollout: {
        appIds: [APP_ID],
        publisherIds: [],
      },
    });
    expect(mockModuleAppPaymentService.createPayment.mock.calls[0][0]).not.toHaveProperty(
      'subject',
    );
  });

  it('lists catalog items and cancels only as the authenticated purchaser', async () => {
    const orderId = '00000000-0000-4000-8000-000000000021';
    await expect(createCaller().listCatalog({ appId: APP_ID })).resolves.toEqual([]);
    await expect(createCaller().cancelOrder({ orderId })).resolves.toMatchObject({
      status: 'cancelled',
    });
    expect(mockModuleAppCommerceModel.listCatalog).toHaveBeenCalledWith({ appId: APP_ID });
    expect(mockModuleAppCommerceModel.cancelOrder).toHaveBeenCalledWith({
      orderId,
      purchaserUserId: 'user-1',
    });
  });

  it('requires current workspace membership before workspace checkout and license lookup', async () => {
    const productId = '00000000-0000-4000-8000-000000000031';
    const idempotencyKey = '00000000-0000-4000-8000-000000000032';
    mockGetWorkspaceMember.mockResolvedValueOnce(null);
    await expect(
      createCaller().createOrder({ idempotencyKey, productId, workspaceId: 'workspace-1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'module_app_workspace_denied' });
    expect(mockModuleAppCommerceModel.createOrder).not.toHaveBeenCalled();

    mockGetWorkspaceMember.mockResolvedValueOnce({ role: 'member', workspaceId: 'workspace-1' });
    await expect(
      createCaller().getLicense({ appId: APP_ID, workspaceId: 'workspace-1' }),
    ).resolves.toBeNull();
    expect(mockModuleAppCommerceModel.resolveLicense).toHaveBeenCalledWith({
      appId: APP_ID,
      workspaceId: 'workspace-1',
    });
  });
});
