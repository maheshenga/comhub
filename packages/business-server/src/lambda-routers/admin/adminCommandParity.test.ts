import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ADMIN_COMMANDS, type AdminCapability } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

const middlewareByCapability: Record<AdminCapability, string> = {
  'admin.access': 'adminProcedure',
  'audit.read': 'auditReadProcedure',
  'content.read': 'contentReadProcedure',
  'content.write': 'contentWriteProcedure',
  'finance.read': 'financeReadProcedure',
  'finance.write': 'financeWriteProcedure',
  'modelOps.read': 'modelOpsReadProcedure',
  'modelOps.write': 'modelOpsWriteProcedure',
  'moduleApp.read': 'moduleAppReadProcedure',
  'moduleApp.write': 'moduleAppWriteProcedure',
  'support.write': 'supportWriteProcedure',
  'system.read': 'systemReadProcedure',
  'system.write': 'systemWriteProcedure',
  'user.read': 'userReadProcedure',
};

const externalEffectCommands = new Set([
  'content.deleteDocument',
  'content.deleteFile',
  'desktop.buildAsset.complete',
  'desktop.release.dispatch',
  'desktop.release.reconcile',
  'desktop.release.retry',
]);
const nestedTransactionAuditCommandNames: Record<string, string> = {
  'desktop.release.activate': 'activateDesktopReleaseCommand',
  'desktop.release.create': 'createDesktopReleaseCreationCommand',
};
const auditOnlyCommands = new Set(['user.impersonate.attempt']);

const sensitiveMutationRouters = [
  'content.ts',
  'newapiProviders.ts',
  'orders.ts',
  'plans.ts',
  'settings.ts',
  'subscriptions.ts',
  'topupPackages.ts',
  'users.ts',
];

const escapeRegExp = (value: string) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getProcedureSource = (procedurePath: string) => {
  const [, routerName, procedureName] = procedurePath.split('.');
  const settingsProcedureSources: Record<string, string> = {
    runMaintenance: '../../appSettings/writers/runtimeProcedures.ts',
    setAppSetting: '../../appSettings/writers/adminProcedures.ts',
    setModuleAppRuntimeSettings: '../../appSettings/writers/adminProcedures.ts',
    setAppSettingsBatch: '../../appSettings/writers/adminProcedures.ts',
  };
  const sourcePath =
    routerName === 'settings' && settingsProcedureSources[procedureName]
      ? path.resolve(__dirname, settingsProcedureSources[procedureName])
      : path.join(__dirname, `${routerName}.ts`);
  const source = readFileSync(sourcePath, 'utf8');
  const marker = `  ${procedureName}:`;
  const start = source.indexOf(marker);
  expect(start, procedurePath).toBeGreaterThanOrEqual(0);

  const nextProcedure = source.slice(start + marker.length).search(/\n {2}[A-Z]\w*:/i);
  const end = nextProcedure < 0 ? source.length : start + marker.length + nextProcedure;

  return { block: source.slice(start, end), source };
};

describe('admin command router parity', () => {
  // M4 §6.3 dual-command reuse point: `admin.desktop.createDesktopRelease`
  // dispatches both the `desktop.release.create` (freeze) and
  // `desktop.release.dispatch` (workflow) audit actions from one validated
  // envelope; its input schema carries the create command's schema and the
  // mutation derives both audit actions from the catalog definitions.
  const dualCommandReuseProcedure = 'admin.desktop.createDesktopRelease';
  const dualCommandRouterCommandNames: Record<string, string> = {
    'desktop.release.create': 'createDesktopReleaseCreationCommand',
    'desktop.release.dispatch': 'createDesktopReleaseCommand',
  };

  it('wires every catalog procedure to its declared middleware and command definition', () => {
    for (const definition of Object.values(ADMIN_COMMANDS)) {
      if (definition.serverBoundary.kind !== 'trpc') continue;

      const { block, source } = getProcedureSource(definition.serverBoundary.procedurePath);
      const middleware = middlewareByCapability[definition.capability];

      expect(block, definition.actionId).toMatch(
        new RegExp(`^  [A-Za-z][A-Za-z0-9_]*: ${escapeRegExp(middleware)}`),
      );

      if (definition.serverBoundary.procedurePath === dualCommandReuseProcedure) {
        const commandName = dualCommandRouterCommandNames[definition.actionId];
        expect(source, definition.actionId).toMatch(
          new RegExp(
            `const ${commandName} = createAdminCommand\\('${escapeRegExp(definition.actionId)}'\\)`,
          ),
        );
        expect(block, definition.actionId).toContain('command: createDesktopReleaseCreationCommand.schema');
        expect(block, definition.actionId).toContain('auditAction:');
        expect(block, definition.actionId).toMatch(/runRequiredAdminAuditExternalEffect\(/);
        continue;
      }


      if (definition.confirmationMode === 'none') {
        const nestedCommandName = nestedTransactionAuditCommandNames[definition.actionId];
        if (nestedCommandName) {
          expect(source, definition.actionId).toMatch(
            new RegExp(
              `const ${nestedCommandName} = createAdminCommand\\('${escapeRegExp(definition.actionId)}'\\)`,
            ),
          );
          expect(block, definition.actionId).toContain(
            `action: ${nestedCommandName}.definition.auditAction`,
          );
          expect(block, definition.actionId).toMatch(/runRequiredAdminAuditMutation(?:<[^>]+>)?\(/);
          continue;
        }

        const commandMatch = block.match(/action: ([A-Za-z]\w*)\.definition\.auditAction/);
        expect(commandMatch, definition.actionId).not.toBeNull();

        const commandName = commandMatch![1];
        expect(source, definition.actionId).toMatch(
          new RegExp(
            `const ${commandName} = createAdminCommand\\('${escapeRegExp(definition.actionId)}'\\)`,
          ),
        );
        continue;
      }

      const schemaMatch = block.match(/command: ([A-Za-z]\w*)\.schema/);
      expect(schemaMatch, definition.actionId).not.toBeNull();

      const commandName = schemaMatch![1];
      expect(source, definition.actionId).toMatch(
        new RegExp(
          `const ${commandName} = createAdminCommand\\('${escapeRegExp(definition.actionId)}'\\)`,
        ),
      );
      if (definition.reasonPolicy !== 'none') {
        const reasonSchema = block.match(/reason:\s*z\.string\(\)[^,\n]*/);
        expect(reasonSchema, definition.actionId).not.toBeNull();
        expect(reasonSchema![0], definition.actionId).toContain('.optional()');
      }
      expect(block, definition.actionId).toContain(
        definition.reasonPolicy === 'none'
          ? `const command = ${commandName}.validate(input.command);`
          : `const command = ${commandName}.validate(input.command, input.reason);`,
      );
      expect(block, definition.actionId).toContain('action: command.auditAction');

      if (definition.severity === 'high' || definition.severity === 'critical') {
        if (externalEffectCommands.has(definition.actionId)) {
          expect(block, definition.actionId).toMatch(
            /runRequiredAdminAuditExternalEffect(?:<[^>]+>)?\(/,
          );
        } else if (!auditOnlyCommands.has(definition.actionId)) {
          expect(block, definition.actionId).toMatch(/runRequiredAdminAuditMutation(?:<[^>]+>)?\(/);
        }
      }
    }
  });

  it('rejects direct required audit calls after normal database mutation chains', () => {
    for (const routerFile of sensitiveMutationRouters) {
      const source = readFileSync(path.join(__dirname, routerFile), 'utf8');
      const procedureBlocks = source.split(/\n {2}\w+:/);

      for (const block of procedureBlocks) {
        expect(block, routerFile).not.toMatch(
          /(?:ctx\.serverDB|tx)\.(?:delete|insert|update)\([\s\S]*?await recordAdminAudit\(ctx,/,
        );
      }
    }
  });

  it('keeps moduleApps mutation audits inside the business transaction (audit consistency)', () => {
    // M4 §6.2: every moduleApps write path audits through
    // runRequiredModuleAppAuditMutation so the audit row commits or rolls
    // back with the business write. A mutation that mutates through
    // `ctx.serverDB` (outside any transaction) and then calls the audit
    // helper afterwards is the exact drift this gate blocks; the two
    // allowed shapes are (a) the read-side export audit on a query (no
    // business write) and (b) the product write that already threads `tx`
    // through writeAudit directly.
    const source = readFileSync(path.join(__dirname, 'moduleApps.ts'), 'utf8');
    const procedureBlocks = source.slice(source.indexOf('export const adminModuleAppsRouter'));
    const entries = procedureBlocks.split(/\n {2}(?=[A-Za-z][A-Za-z0-9]*:)/).slice(1);

    expect(entries.length).toBeGreaterThan(10);

    for (const block of entries) {
      const isMutation = /\.mutation\(/.test(block);
      if (!isMutation) continue;

      // A transactional mutation either uses the required audit wrapper or
      // threads its tx into writeAudit; both keep the audit atomic.
      const transactionalAudit =
        /runRequiredModuleAppAuditMutation(?:<[^>]+>)?\(/.test(block) ||
        /runRequiredAdminAuditExternalEffect\(/.test(block) ||
        /writeAudit\(\s*\{[^}]*serverDB:\s*tx/.test(block);

      if (transactionalAudit) continue;

      // Non-transactional mutations must not perform any database write at
      // all — otherwise their audit could not be transactional.
      expect(block, block.slice(0, 60)).not.toMatch(
        /new \w+Model\(ctx\.serverDB\)|new \w+Service\(\{ db: ctx\.serverDB \}|\(await createConfiguredModulePaymentService\(ctx\.serverDB\)\)/,
      );
    }
  });

  it('keeps parity coverage catalog-generated with error and warning tiers', () => {
    // Coverage is derived from the catalog itself (ADMIN_COMMANDS), not a
    // hand-maintained list: every trpc-bound command must pass the wiring
    // assertions above (already enforced per-definition in the first test).
    // The error tier re-checks that no catalog command escaped iteration;
    // the warning tier tracks http-boundary commands (currently 1) without
    // failing until a tRPC migration lands.
    const trpcBound = Object.values(ADMIN_COMMANDS).filter(
      ({ serverBoundary }) => serverBoundary.kind === 'trpc',
    );
    const httpBound = Object.values(ADMIN_COMMANDS).filter(
      ({ serverBoundary }) => serverBoundary.kind === 'http',
    );

    expect(trpcBound.length).toBeGreaterThan(20);
    expect(httpBound.map(({ actionId }) => actionId)).toEqual(['user.impersonate.attempt']);
  });
});
