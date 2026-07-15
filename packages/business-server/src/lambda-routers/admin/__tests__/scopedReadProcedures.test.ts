import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const readRouter = (name: string) =>
  readFileSync(path.resolve(__dirname, `../${name}.ts`), 'utf8').replaceAll(/\s+/g, ' ');

describe('scoped admin read procedures', () => {
  it('uses finance.read for finance-domain reads', () => {
    const expectations: Record<string, string[]> = {
      credits: [
        'getBalance: financeReadProcedure',
        'ledger: financeReadProcedure',
        'listAccounts: financeReadProcedure',
      ],
      orders: ['getDetail: financeReadProcedure', 'list: financeReadProcedure'],
      plans: ['list: financeReadProcedure'],
      subscriptions: [
        'getUserSubscription: financeReadProcedure',
        'list: financeReadProcedure',
        'listChangeRequests: financeReadProcedure',
      ],
      topupPackages: ['list: financeReadProcedure'],
    };

    for (const [router, fragments] of Object.entries(expectations)) {
      const source = readRouter(router);
      expect(source).toContain('ADMIN_CAPABILITIES.financeRead');
      for (const fragment of fragments) expect(source).toContain(fragment);
    }
  });

  it('uses read capabilities for user, model, content, audit, and system reads', () => {
    const expectations: Array<[string, string, string[]]> = [
      [
        'users',
        'ADMIN_CAPABILITIES.userRead',
        ['detail: userReadProcedure', 'exportAll: userReadProcedure'],
      ],
      [
        'newapiProviders',
        'ADMIN_CAPABILITIES.modelOpsRead',
        [
          'getInstance: modelOpsReadProcedure',
          'listInstances: modelOpsReadProcedure',
          'getModelCatalogDiagnostics: modelOpsReadProcedure',
          'listModels: modelOpsReadProcedure',
          'getAllEnabledModels: modelOpsReadProcedure',
        ],
      ],
      [
        'content',
        'ADMIN_CAPABILITIES.contentRead',
        [
          'listDocuments: contentReadProcedure',
          'listFiles: contentReadProcedure',
          'listTopics: contentReadProcedure',
        ],
      ],
      [
        'audit-router',
        'ADMIN_CAPABILITIES.auditRead',
        ['list: auditReadProcedure', 'exportAll: auditReadProcedure'],
      ],
      [
        'settings',
        'ADMIN_CAPABILITIES.systemRead',
        [
          'getGovernance: systemReadProcedure',
          'getAll: systemReadProcedure',
          'validateDefaultAgentSettings: systemReadProcedure',
        ],
      ],
      [
        'ppt',
        'ADMIN_CAPABILITIES.systemRead',
        ['getSettings: systemReadProcedure'],
      ],
    ];

    for (const [router, capability, fragments] of expectations) {
      const source = readRouter(router);
      expect(source).toContain(capability);
      for (const fragment of fragments) expect(source).toContain(fragment);
    }
  });

  it('binds read wrappers to their exact capabilities', () => {
    const expectations: Array<[string, string]> = [
      [
        'users',
        'const userReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.userRead)',
      ],
      [
        'newapiProviders',
        'const modelOpsReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.modelOpsRead)',
      ],
      [
        'content',
        'const contentReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.contentRead)',
      ],
      [
        'settings',
        'const systemReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemRead)',
      ],
      [
        'ppt',
        'const systemReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemRead)',
      ],
    ];

    for (const [router, declaration] of expectations) {
      expect(readRouter(router)).toContain(declaration);
    }
  });

  it('keeps synchronization-backed user queries write-bound', () => {
    const users = readRouter('users');

    expect(users).toContain(
      'const supportWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.supportWrite)',
    );
    expect(users).toContain('fullDetail: supportWriteProcedure');
    expect(users).toContain('list: supportWriteProcedure');
    expect(users).toMatch(
      /fullDetail: supportWriteProcedure .*? await syncExpiredSubscriptionsToFree\(ctx\.serverDB\)/,
    );
    expect(users).toMatch(
      /list: supportWriteProcedure .*? await syncExpiredSubscriptionsToFree\(ctx\.serverDB\)/,
    );
  });

  it('keeps side-effecting diagnostics and cache operations write-bound', () => {
    const providers = readRouter('newapiProviders');
    const settings = readRouter('settings');

    expect(providers).toContain('testInstanceConnection: modelOpsWriteProcedure');
    expect(providers).toContain('refreshRuntimeCache: modelOpsWriteProcedure');
    expect(providers).toContain('syncInstanceModels: modelOpsWriteProcedure');
    expect(settings).toContain('refreshRuntimeCaches: systemWriteProcedure');
    expect(settings).toContain('testS3Storage: systemWriteProcedure');
    expect(settings).toContain('runMaintenance: systemWriteProcedure');
  });
});
