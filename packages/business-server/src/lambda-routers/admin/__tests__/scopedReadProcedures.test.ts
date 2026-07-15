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
        [
          'detail: userReadProcedure',
          'fullDetail: userReadProcedure',
          'list: userReadProcedure',
          'exportAll: userReadProcedure',
        ],
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
