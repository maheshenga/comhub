import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  findModuleForPath,
  listModuleFiles,
  registryModules,
  syncStrategies,
  UPSTREAM_BASELINE_TAG,
} from './registry.mjs';

test('registry has a fixed baseline tag', () => {
  assert.equal(UPSTREAM_BASELINE_TAG, 'v2.2.18');
});

test('every module has required metadata', () => {
  const ids = new Set();
  for (const module of registryModules) {
    assert.ok(module.id, 'module missing id');
    assert.ok(!ids.has(module.id), `duplicate module id: ${module.id}`);
    ids.add(module.id);
    assert.ok(module.name, `${module.id} missing name`);
    assert.ok(module.description, `${module.id} missing description`);
    assert.ok(
      ['re-apply', 'merge', 'verify-only', 'annotate-only'].includes(module.sync),
      `${module.id} has invalid sync strategy: ${module.sync}`,
    );
    assert.ok(Array.isArray(module.ownershipRules), `${module.id} missing ownershipRules`);
    assert.ok(module.ownershipRules.length > 0, `${module.id} has no ownership rules`);
    assert.ok(Array.isArray(module.tests), `${module.id} missing tests array`);
    for (const [match, ownership] of module.ownershipRules) {
      assert.ok(
        ownership === 'owned' || ownership === 'upstream',
        `${module.id} rule ${match} has invalid ownership ${ownership}`,
      );
    }
  }
});

test('sync strategies are drawn from the known set', () => {
  for (const strategy of syncStrategies) {
    assert.ok(['re-apply', 'merge', 'verify-only', 'annotate-only'].includes(strategy));
  }
});

test('prefix rules are anchored and regex rules compile', () => {
  for (const module of registryModules) {
    for (const [match] of module.ownershipRules) {
      if (match.startsWith('p:')) {
        assert.ok(match.length > 2, `${module.id} empty prefix rule`);
      } else {
        assert.doesNotThrow(() => new RegExp(match), `${module.id} invalid regex: ${match}`);
      }
    }
  }
});

test('hotspot files resolve to their expected modules', () => {
  const expectations = [
    ['apps/desktop/src/main/utils/protocol.ts', 'desktop-deep-links', 'upstream'],
    ['src/components/BrandWatermark/index.tsx', 'branding', 'upstream'],
    ['src/components/Branding/ProductLogo/index.tsx', 'branding', 'upstream'],
    ['src/features/Brand/BrandProvider.tsx', 'branding', 'owned'],
    ['src/const/brand.ts', 'branding', 'owned'],
    ['apps/server/src/services/usage/index.ts', 'server-usage-ledger', 'upstream'],
    ['apps/server/src/modules/S3/index.ts', 'server-storage-s3', 'owned'],
    ['apps/server/src/modules/S3/s3Client.ts', 'server-storage-s3', 'owned'],
    ['apps/server/src/services/agent/index.ts', 'server-agent-guard', 'upstream'],
    ['packages/model-runtime/src/core/ModelRuntime.ts', 'commercial-billing', 'upstream'],
    ['packages/business-server/src/model-runtime.ts', 'commercial-billing', 'upstream'],
    [
      'src/features/Admin/DesktopControlCenter/BuildProfileForm.tsx',
      'desktop-build-profile',
      'owned',
    ],
    ['apps/desktop/desktop-build-profile.mjs', 'desktop-build-profile', 'owned'],
    ['.github/workflows/comhub-desktop-release.yml', 'desktop-release-pipeline', 'owned'],
    ['.github/workflows/comhub-deploy.yml', 'ci-deploy', 'owned'],
    ['.github/workflows/verify-share.yml', 'ci-deploy', 'upstream'],
    ['packages/database/migrations/meta/_journal.json', 'database-migrations', 'upstream'],
    ['packages/database/src/core/web-server.ts', 'db-pool-guardrails', 'upstream'],
    ['src/app/[variants]/(auth)/layout.tsx', 'auth-fork', 'owned'],
    ['src/features/MobileWorkspace/Recent/index.tsx', 'mobile-workspace', 'owned'],
    ['apps/module-worker/src/integration.test.ts', 'module-app-platform', 'owned'],
    ['pnpm-workspace.yaml', 'deps-pins', 'upstream'],
    ['locales/zh-CN/subscription.json', 'locales', 'upstream'],
  ];
  for (const [path, moduleId, ownership] of expectations) {
    const hit = findModuleForPath(path);
    assert.ok(hit, `no module claims ${path}`);
    assert.equal(hit.module.id, moduleId, `${path} should belong to ${moduleId}`);
    assert.equal(hit.ownership, ownership, `${path} ownership mismatch`);
  }
});

test('first matching rule wins (desktop utils stays in deep-links module)', () => {
  const hit = findModuleForPath('apps/desktop/src/main/utils/protocol.ts');
  assert.equal(hit.module.id, 'desktop-deep-links');
  assert.notEqual(hit.module.id, 'desktop-main-patches');
});

test('plannedExtraction only appears on deferred hotspots', () => {
  for (const module of registryModules) {
    if (module.plannedExtraction) {
      assert.ok(
        ['commercial-billing', 'ui-integration'].includes(module.id),
        `unexpected plannedExtraction on ${module.id}`,
      );
    }
  }
});

test('listModuleFiles returns rule triples', () => {
  const rules = listModuleFiles('branding');
  assert.ok(rules.length > 0);
  for (const rule of rules) {
    assert.ok('match' in rule && 'ownership' in rule && 'note' in rule);
  }
  assert.deepEqual(listModuleFiles('no-such-module'), []);
});
