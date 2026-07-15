import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  path.resolve(process.cwd(), 'apps/server/src/routers/lambda/moduleApp/runtime.ts'),
  'utf8',
);

describe('module app runtime dependency wiring', () => {
  it('injects every privileged runtime dependency explicitly', () => {
    for (const dependency of [
      'const artifactStorage = new FileS3()',
      'artifactStorage: {',
      'await artifactStorage.uploadBuffer(key, buffer, contentType)',
      'billing: installation.billing',
      'const creditAdapter = new ModuleAppCreditModel(ctx.serverDB)',
      'creditAdapter,',
      'outboundHosts,',
      'resolvedSecrets,',
      'serverAction: createModuleAppServerAction({ db: ctx.serverDB })',
      'workflow,',
      'workflowEngine,',
    ]) {
      expect(source).toContain(dependency);
    }
  });

  it('loads only declared installation secrets and exact manifest workflows', () => {
    expect(source).toContain('resolveModuleAppActionOutboundHosts({');
    expect(source).toContain('resolveModuleAppActionSecrets({');
    expect(source).toContain('getInstallationSecret({');
    expect(source).toContain('resolveModuleAppWorkflowAction({ action, runtimeManifest: installation.runtimeManifest })');
  });

  it('keeps privileged action execution behind the execution rollout flag', () => {
    expect(source).toContain("['api_action', 'content_generation', 'executable_action', 'server_action', 'workflow_step']");
    expect(source).toContain('!appEnv.MODULE_APP_EXECUTION_ENABLED');
  });
});
