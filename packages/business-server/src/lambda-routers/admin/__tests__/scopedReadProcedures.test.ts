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

  it('uses the matching capability for user, model, content, audit, and system reads', () => {
    const expectations: Array<[string, string, string[]]> = [
      [
        'users',
        'ADMIN_CAPABILITIES.userWrite',
        [
          'detail: userWriteProcedure',
          'fullDetail: userWriteProcedure',
          'list: userWriteProcedure',
        ],
      ],
      [
        'newapiProviders',
        'ADMIN_CAPABILITIES.modelOpsWrite',
        [
          'getInstance: modelOpsWriteProcedure',
          'listInstances: modelOpsWriteProcedure',
          'listModels: modelOpsWriteProcedure',
        ],
      ],
      [
        'content',
        'ADMIN_CAPABILITIES.contentWrite',
        [
          'listDocuments: contentProcedure',
          'listFiles: contentProcedure',
          'listTopics: contentProcedure',
        ],
      ],
      [
        'audit-router',
        'ADMIN_CAPABILITIES.auditRead',
        ['list: auditReadProcedure', 'exportAll: auditReadProcedure'],
      ],
      [
        'settings',
        'ADMIN_CAPABILITIES.systemWrite',
        ['getGovernance: systemReadProcedure', 'getAll: systemReadProcedure'],
      ],
    ];

    for (const [router, capability, fragments] of expectations) {
      const source = readRouter(router);
      expect(source).toContain(capability);
      for (const fragment of fragments) expect(source).toContain(fragment);
    }
  });
});
