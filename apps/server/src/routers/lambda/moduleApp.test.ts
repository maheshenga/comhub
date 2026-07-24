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
  mockRuntimeClientInvoke,
  mockRunModuleAppAction,
  mockModuleAppCommerceModel,
  mockModuleAppPaymentService,
  mockCreateConfiguredModuleAppAlipayClient,
  mockModuleAppModel,
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
  mockCreateConfiguredModuleAppAlipayClient: vi.fn(() => ({ provider: 'alipay' })),
  mockModuleAppModel: {
    assertInstallationAccess: vi.fn(),
    createRecord: vi.fn(),
    createRun: vi.fn(),
    getAppDetail: vi.fn(),
    getLaunchInstallationContext: vi.fn(),
    installPersonalApp: vi.fn(),
    installWorkspaceApp: vi.fn(),
    listAdminPackageSubmissions: vi.fn(),
    listArtifacts: vi.fn(),
    listInstalledApps: vi.fn(),
    listMarketplaceApps: vi.fn(),
    uninstallWorkspaceApp: vi.fn(),
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
  ModuleAppPackageIngestionService: vi.fn(() => mockIngestionService),
}));

vi.mock('@/server/services/moduleAppAi', () => ({
  createModuleAppTextGenerator: mockCreateModuleAppTextGenerator,
}));

vi.mock('@/server/services/moduleAppRuntime/capability', () => ({
  signModuleAppCapability: mockSignModuleAppCapability,
  verifyModuleAppCapability: mockVerifyModuleAppCapability,
}));

vi.mock('@/database/models/workspaceMember', () => ({
  WorkspaceMemberModel: vi.fn(() => ({ getMember: mockGetWorkspaceMember })),
}));

vi.mock('@/server/services/moduleAppRuntime/gateway', () => ({
  createModuleAppCapabilityGateway: vi.fn(() => mockModuleAppGateway),
}));

vi.mock('@/server/services/moduleAppRuntime/client', () => ({
  ModuleAppRuntimeClient: vi.fn(() => ({ invoke: mockRuntimeClientInvoke })),
}));

vi.mock('@/database/models/moduleApp', () => ({
  ModuleAppModel: vi.fn(() => mockModuleAppModel),
}));

vi.mock('@/database/models/moduleAppCommerce', () => ({
  ModuleAppCommerceModel: vi.fn(() => mockModuleAppCommerceModel),
}));

vi.mock('@/business/server/module-apps/payments/service', () => ({
  ModuleAppPaymentService: vi.fn(() => mockModuleAppPaymentService),
}));

vi.mock('@/server/services/moduleAppPayments/alipay/client', () => ({
  createConfiguredModuleAppAlipayClient: mockCreateConfiguredModuleAppAlipayClient,
}));

vi.mock('@/database/models/moduleAppWorkflow', () => ({
  ModuleAppWorkflowModel: vi.fn(() => mockModuleAppWorkflowModel),
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
    mockModuleAppPaymentService.createPayment.mockResolvedValue({
      body: '<form></form>',
      outTradeNo: 'out-1',
    });
    mockModuleAppModel.getAppDetail.mockResolvedValue({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: false, visible: true },
    });
    mockModuleAppModel.installPersonalApp.mockResolvedValue(undefined);
    mockModuleAppModel.installWorkspaceApp.mockResolvedValue(undefined);
    mockModuleAppModel.uninstallWorkspaceApp.mockResolvedValue({ ok: true });
    mockModuleAppModel.listMarketplaceApps.mockResolvedValue([]);
    mockModuleAppModel.listInstalledApps.mockResolvedValue([]);
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

  it('composes the root router exclusively from domain procedure records', () => {
    const domainRecords = [
      moduleAppMarketProcedures,
      moduleAppRuntimeProcedures,
      moduleAppDataProcedures,
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
      cancelOrder: { inputs: 1, type: 'mutation' },
      cancelWorkflowRun: { inputs: 1, type: 'mutation' },
      createOrder: { inputs: 1, type: 'mutation' },
      createPackageUpload: { inputs: 1, type: 'mutation' },
      createPayment: { inputs: 1, type: 'mutation' },
      createRecord: { inputs: 1, type: 'mutation' },
      getDetail: { inputs: 1, type: 'query' },
      getLaunchContext: { inputs: 1, type: 'query' },
      getLicense: { inputs: 1, type: 'query' },
      getRecord: { inputs: 1, type: 'query' },
      getRuntimeManifest: { inputs: 1, type: 'query' },
      getWorkflowRun: { inputs: 1, type: 'query' },
      installPersonal: { inputs: 1, type: 'mutation' },
      installWorkspace: { inputs: 1, type: 'mutation' },
      listArtifacts: { inputs: 1, type: 'query' },
      listCatalog: { inputs: 1, type: 'query' },
      listMarketplace: { inputs: 1, type: 'query' },
      listMobileApps: { inputs: 1, type: 'query' },
      listMyApps: { inputs: 0, type: 'query' },
      listMyPackageSubmissions: { inputs: 1, type: 'query' },
      listOrders: { inputs: 1, type: 'query' },
      listRecords: { inputs: 1, type: 'query' },
      listRuns: { inputs: 1, type: 'query' },
      listTeamApps: { inputs: 1, type: 'query' },
      listWorkflowNodes: { inputs: 1, type: 'query' },
      quoteProduct: { inputs: 1, type: 'query' },
      runAction: { inputs: 1, type: 'mutation' },
      submitUploadedPackage: { inputs: 1, type: 'mutation' },
      uninstallPersonal: { inputs: 1, type: 'mutation' },
      uninstallWorkspace: { inputs: 1, type: 'mutation' },
      updateRecord: { inputs: 1, type: 'mutation' },
    };
    const inputSchemaContract: Record<string, null | string> = {
      archiveRecord: '854df8f9f82f8626a7382dce00b8145f17645b5d5e0363dcfd066b64fc7c2c49',
      callSdk: 'bc51dc2b9504f9c2ed731dd8f98671de81c2eb91af74762ac0ae46390570c671',
      cancelOrder: '3130fc6ed9a08d9fc1d6295ff15adb99797d435765068b31a02cf3f4b580bc7b',
      cancelWorkflowRun: '7718a352059ff192410c0012426887ce0323f1db865047e26f26f8c5773f0959',
      createOrder: 'cf24b73b30375897e4a9fa81e9a54c7de4a7247ef4c4dba6a9d4f9e35913c210',
      createPackageUpload: '93f1a0509a31e23a1e66b6a220165f5bd931503fc148bf8a0e2b7f213ca5a969',
      createPayment: 'ebe3b1afa36f2514174957f1ba37d6baadf21e2c82a244f0e117b484160c132e',
      createRecord: '6e9a074dc84ace871f6347bdc0833bc657d4ad409e99a71ae06de10f91deb29a',
      getDetail: '181ce63c50f354d33e38e7a1aacad923df4ee451bb755cd3d664f4f6890047b0',
      getLaunchContext: '73c92b6fc5923def54e2595f57fc567802693d056634a75bd7031c1cf78971c8',
      getLicense: '73c92b6fc5923def54e2595f57fc567802693d056634a75bd7031c1cf78971c8',
      getRecord: '854df8f9f82f8626a7382dce00b8145f17645b5d5e0363dcfd066b64fc7c2c49',
      getRuntimeManifest: '60a3787f96995f4ebb7ea3aa513c97a971dcfa68a604864fe740106bdf68c515',
      getWorkflowRun: '7718a352059ff192410c0012426887ce0323f1db865047e26f26f8c5773f0959',
      installPersonal: '60a3787f96995f4ebb7ea3aa513c97a971dcfa68a604864fe740106bdf68c515',
      installWorkspace: 'dad62ad0a3953ccbb0f9da06a741fbfc319be708e14d4da4e35c668b56564f97',
      listArtifacts: '43e4cea8d4d8a7d47b62b6d42cea3420a57d4f67d0def09fd90f4f48e51a41f7',
      listCatalog: 'fbed6b4881d01ef729f244ed5b4795c427f4dfdba7a910b909ba8c0f364714f1',
      listMarketplace: '7699c86549809458043fa74a895e3ac49562495b1bdac9c2e3514c3ea5f227af',
      listMobileApps: '08e0dbac399b66eb82aeddd0b5a211271ea2d4294dcc0fd40f9459d2b289a630',
      listMyApps: null,
      listMyPackageSubmissions: '92ca0a7abe13012bc74d99c1ec6a61f85d12e583360292a35d15f05281bebec5',
      listOrders: 'f1cd8d8ac045d434ef05ccbd4a304bcd7ab3a4e5eceae386b412e1f533fa3cf2',
      listRecords: '143ebe78721eeeb03dfc77f8a247647a5ef8ec4f890020bb3266fb522c398a71',
      listRuns: '43e4cea8d4d8a7d47b62b6d42cea3420a57d4f67d0def09fd90f4f48e51a41f7',
      listTeamApps: 'dba8eab472ae20562fef13dcf47022b1da58000b4be5fbbf3737cfab2168c125',
      listWorkflowNodes: '7718a352059ff192410c0012426887ce0323f1db865047e26f26f8c5773f0959',
      quoteProduct: 'a9cb754e0714fabb188d6dd9d2af27b1ee6f8bdafeceb7700ba08bd7299d7adc',
      runAction: 'd68bc0413b5fcedfd583eb96330011dfb30aadddb4add64d30d12ebc4f297984',
      submitUploadedPackage: '74eff14aff88a2463579fec57327dd724b23d3decda13a51d038eb7c6e4da43f',
      uninstallPersonal: '60a3787f96995f4ebb7ea3aa513c97a971dcfa68a604864fe740106bdf68c515',
      uninstallWorkspace: 'dad62ad0a3953ccbb0f9da06a741fbfc319be708e14d4da4e35c668b56564f97',
      updateRecord: '6b12c59563a0e4a4ce7df592bf5d65c0b2df02ffaba10e8dbeaa0ed7e06e1bb1',
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
    for (const [key, expected] of Object.entries(contract)) {
      const procedure = moduleAppProcedureRecord[key];
      const middlewares = (procedure._def as typeof procedure._def & { middlewares: unknown[] })
        .middlewares;
      const input = procedure._def.inputs[0];
      const inputSchemaSha256 = input ? fingerprintParser(input as ZodTypeAny) : null;

      expect(procedure._def.type, key).toBe(expected.type);
      expect(procedure._def.inputs, key).toHaveLength(expected.inputs);
      expect(inputSchemaSha256, key).toBe(inputSchemaContract[key]);
      expect(middlewares.slice(0, baseMiddlewares.length), key).toEqual(baseMiddlewares);
      expect(middlewares, key).toHaveLength(baseMiddlewares.length + expected.inputs + 1);
    }
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

  it('returns an allowlisted static launch context while general execution is disabled', async () => {
    mockAppEnv.MODULE_APP_EXECUTION_ENABLED = false;
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });

    await expect(createCaller().getLaunchContext({ appId: APP_ID })).resolves.toMatchObject({
      capability: 'signed-launch-capability',
      iframeUrl: expect.stringContaining('/artifacts/'),
      installationId: '00000000-0000-4000-8000-000000000010',
      runtimeOrigin: 'https://module-runtime.example.com',
    });
    expect(mockSignModuleAppCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: APP_ID,
        permissions: ['context.read'],
        surface: 'browser',
        userId: 'user-1',
      }),
      expect.objectContaining({ expiresInSeconds: 300 }),
    );
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
        planState: { installable: true, runnable: true, visible: true },
        status: 'published',
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        planState: { installable: false, runnable: false, visible: false },
        status: 'published',
      },
    ]);

    await expect(createCaller().listMarketplace({})).resolves.toEqual([
      expect.objectContaining({ id: APP_ID }),
    ]);
    expect(mockModuleAppModel.listMarketplaceApps).toHaveBeenCalledWith(
      expect.objectContaining({ includeHidden: true, plan: 'free', userId: 'user-1' }),
    );
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
      workspaceId,
    });

    mockGetWorkspaceMember.mockResolvedValueOnce(null);
    await expect(
      createCaller().installWorkspace({ appId: APP_ID, workspaceId: 'workspace-denied' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'module_app_workspace_denied' });
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
    expect(mockModuleAppCommerceModel.createOrder).not.toHaveBeenCalled();
    expect(mockModuleAppModel.installWorkspaceApp).not.toHaveBeenCalled();
    expect(mockModuleAppModel.uninstallWorkspaceApp).not.toHaveBeenCalled();
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

  it('keeps Alipay checkout disabled until the server feature flag is enabled', async () => {
    mockAppEnv.MODULE_APP_ALIPAY_ENABLED = true;
    await expect(
      createCaller().createPayment({
        orderId: '00000000-0000-4000-8000-000000000021',
        subject: 'Module App Pro',
      }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'module_app_alipay_payment_creation_disabled',
    });
    expect(mockModuleAppPaymentService.createPayment).not.toHaveBeenCalled();
  });

  it('creates Alipay checkout from authenticated order and server callback URLs', async () => {
    mockAppEnv.MODULE_APP_ALIPAY_ENABLED = true;
    mockAppEnv.MODULE_APP_ALIPAY_PAYMENT_CREATION_ENABLED = true;
    const orderId = '00000000-0000-4000-8000-000000000021';

    await expect(
      createCaller().createPayment({ orderId, subject: 'Module App Pro' }),
    ).resolves.toMatchObject({ outTradeNo: 'out-1' });
    expect(mockModuleAppPaymentService.createPayment).toHaveBeenCalledWith({
      notifyUrl: mockAppEnv.MODULE_APP_ALIPAY_NOTIFY_URL,
      orderId,
      purchaserUserId: 'user-1',
      returnUrl: mockAppEnv.MODULE_APP_ALIPAY_RETURN_URL,
      rollout: {
        appIds: [APP_ID],
        publisherIds: [],
      },
      subject: 'Module App Pro',
    });
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
