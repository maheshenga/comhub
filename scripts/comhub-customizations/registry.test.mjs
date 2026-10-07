import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

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
    // upstream barrel: exists in v2.2.18 (blob bdbe7fd1) and is fork-modified
    // (M in diff) — claimed upstream by a precise rule ahead of the owned S3/ dir rule.
    ['apps/server/src/modules/S3/index.ts', 'server-storage-s3', 'upstream'],
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

// ---------------------------------------------------------------------------
// Assertion-hardening round: rule reachability, prefix uniqueness, baseline
// consistency, hookExtracted pairing.
// ---------------------------------------------------------------------------

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const git = (args) =>
  execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/**
 * Local mirror of findModuleForPath's resolution semantics — cross-module
 * scan in registry order, first rule wins, "p:" prefixes via startsWith,
 * everything else as a regex — except it also returns the matched rule so a
 * probe can verify WHICH rule fired. Kept deliberately independent of
 * registry.mjs: if the two ever disagree on a real changed file, the
 * cross-check below fails (implementation drift).
 */
const resolveWithRule = (path) => {
  for (const module of registryModules) {
    for (const [match, ownership, note] of module.ownershipRules) {
      const hit = match.startsWith('p:')
        ? path.startsWith(match.slice(2))
        : new RegExp(match).test(path);
      if (hit) return { module, rule: match, note, ownership };
    }
  }
  return null;
};

/**
 * Probe path that must resolve back to the rule itself: directory rules get a
 * synthetic child file, file rules are probed at their own path. A rule whose
 * probe resolves to some earlier rule is dead — first-match-wins makes it
 * unreachable in practice.
 */
const probeForRule = (match) => {
  const prefix = match.slice(2);
  return prefix.endsWith('/') ? `${prefix}z.ts` : prefix;
};

/** True when the upstream baseline ref is present in this checkout. */
const baselineRefExists = () => {
  try {
    git(['rev-parse', '--verify', `${UPSTREAM_BASELINE_TAG}^{commit}`]);
    return true;
  } catch {
    return false;
  }
};

/** Changed files vs the baseline, parsed like verify.mjs (R/C keep new path). */
const changedFiles = () => {
  const files = [];
  for (const line of git(['diff', '--name-status', UPSTREAM_BASELINE_TAG, 'HEAD']).split('\n')) {
    if (!line.trim()) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const status = line.slice(0, tab);
    let path = line.slice(tab + 1);
    if (status.startsWith('R') || status.startsWith('C')) path = path.split('\t').at(-1);
    files.push({ path, status });
  }
  return files;
};

test('every p: rule is reachable through the first-match scan (no dead rules)', () => {
  const dead = [];
  for (const module of registryModules) {
    for (const [match, ownership] of module.ownershipRules) {
      if (!match.startsWith('p:')) continue;
      const probe = probeForRule(match);
      const hit = resolveWithRule(probe);
      if (
        !hit ||
        hit.module.id !== module.id ||
        hit.rule !== match ||
        hit.ownership !== ownership
      ) {
        dead.push(
          `${module.id} rule '${match}' is shadowed: probe '${probe}' resolved to ` +
            `${hit ? `${hit.module.id} rule '${hit.rule}' (${hit.ownership})` : 'no rule'}`,
        );
      }
    }
  }
  assert.deepEqual(dead, [], `dead/shadowed p: rules (${dead.length}):\n  ${dead.join('\n  ')}`);
});

test('resolveWithRule agrees with findModuleForPath on every changed file', () => {
  if (!baselineRefExists()) {
    console.log(
      `[skip] upstream tag ${UPSTREAM_BASELINE_TAG} not present in this checkout; ` +
        `cross-check against changed files skipped (CI may run this suite before the tag fetch).`,
    );
    return;
  }
  const drift = [];
  for (const { path } of changedFiles()) {
    const a = findModuleForPath(path);
    const b = resolveWithRule(path);
    if (!a || !b) {
      if (a !== b)
        drift.push(
          `${path}: findModuleForPath=${a ? a.module.id : 'null'} vs resolveWithRule=${b ? b.module.id : 'null'}`,
        );
      continue;
    }
    if (a.module.id !== b.module.id || a.ownership !== b.ownership || a.note !== b.note) {
      drift.push(
        `${path}: findModuleForPath=${a.module.id}/${a.ownership} vs ` +
          `resolveWithRule=${b.module.id}/${b.ownership} (note ${a.note === b.note ? 'same' : `'${a.note}' vs '${b.note}'`})`,
      );
    }
  }
  assert.deepEqual(
    drift,
    [],
    `resolveWithRule drifted from findModuleForPath on ${drift.length} changed file(s):\n  ` +
      drift.slice(0, 20).join('\n  '),
  );
});

test('p: rule paths are unique across modules', () => {
  const seen = new Map();
  const dupes = [];
  for (const module of registryModules) {
    for (const [match] of module.ownershipRules) {
      if (!match.startsWith('p:')) continue;
      const prefix = match.slice(2);
      if (seen.has(prefix)) {
        dupes.push(`'${prefix}' claimed by both ${seen.get(prefix)} and ${module.id}`);
      } else {
        seen.set(prefix, module.id);
      }
    }
  }
  assert.deepEqual(dupes, [], `duplicate p: prefixes (${dupes.length}):\n  ${dupes.join('\n  ')}`);
});

test('owned rules never claim upstream baseline paths; exact upstream rules cover upstream adds', () => {
  if (!baselineRefExists()) {
    console.log(
      `[skip] upstream tag ${UPSTREAM_BASELINE_TAG} not present in this checkout; ` +
        `baseline consistency group skipped (CI may run this suite before the tag fetch).`,
    );
    return;
  }
  const upstreamPaths = new Set(
    git(['ls-tree', '-r', '--name-only', UPSTREAM_BASELINE_TAG]).split('\n').filter(Boolean),
  );
  const ownedButUpstream = [];
  const addedUpstreamExact = [];
  /** @type {Map<string, number>} moduleId + rule -> fork-new files over-covered */
  const overCoverWarnings = new Map();
  for (const { status, path } of changedFiles()) {
    const hit = findModuleForPath(path);
    if (!hit) continue; // unregistered files are verify.mjs's failure mode
    if (hit.ownership === 'owned' && upstreamPaths.has(path)) {
      ownedButUpstream.push(
        `${path} (${status}) resolves owned via ${hit.module.id} but exists in upstream ${UPSTREAM_BASELINE_TAG}`,
      );
      continue;
    }
    if (status !== 'A' || hit.ownership !== 'upstream') continue;
    const rule = resolveWithRule(path)?.rule;
    if (rule === `p:${path}`) {
      addedUpstreamExact.push(
        `${path} is added in the fork but ${hit.module.id} claims it upstream via the exact-file rule '${rule}'`,
      );
    } else {
      const key = `${hit.module.id} rule '${rule}'`;
      overCoverWarnings.set(key, (overCoverWarnings.get(key) ?? 0) + 1);
    }
  }
  assert.deepEqual(
    ownedButUpstream,
    [],
    `owned rules claiming files that exist upstream (${ownedButUpstream.length}):\n  ` +
      ownedButUpstream.join('\n  '),
  );
  assert.deepEqual(
    addedUpstreamExact,
    [],
    `fork-added files claimed upstream by exact-file rules (${addedUpstreamExact.length}):\n  ` +
      addedUpstreamExact.join('\n  '),
  );
  // Directory rules legitimately over-cover fork-new files (documented as
  // "conservative over-cover" in the registry notes) — warning only.
  const warningTotal = [...overCoverWarnings.values()].reduce((sum, n) => sum + n, 0);
  console.log(
    `[warning] ${warningTotal} fork-added file(s) resolved 'upstream' via directory/regex ` +
      `rules (documented conservative over-cover), by rule:`,
  );
  for (const [key, count] of [...overCoverWarnings].sort((a, b) => b[1] - a[1])) {
    console.log(`  [warning]   ${String(count).padStart(4)}  ${key}`);
  }
});

test('every hookExtracted rule has a corresponding owned extracted helper earlier in its module', () => {
  const violations = [];
  for (const module of registryModules) {
    for (let i = 0; i < module.ownershipRules.length; i++) {
      const [match, , note] = module.ownershipRules[i];
      if (!note || !note.includes('hookExtracted')) continue;
      // The delegation note names its helper file ("... to generationBillingGuard.ts
      // (hookExtracted)"). Several upstream delegates may share one owned helper
      // (routers/lambda/image and routers/lambda/video both delegate to
      // generationBillingGuard.ts), so the helper only has to sit earlier in the
      // same module — the former "immediately above" adjacency broke on shared
      // helpers and forced the video rule to drop its hookExtracted marker (which
      // silently removed it from verify.mjs's delegate diff budget).
      const earlierHelpers = [];
      for (let j = 0; j < i; j++) {
        const [prevMatch, prevOwnership, prevNote] = module.ownershipRules[j];
        if (prevOwnership !== 'owned') continue;
        if (!prevNote || !prevNote.startsWith('extracted')) continue;
        if (!prevMatch.startsWith('p:')) continue;
        earlierHelpers.push(prevMatch.slice(2).split('/').pop());
      }
      if (earlierHelpers.length === 0) {
        violations.push(
          `${module.id}: rule '${match}' (hookExtracted) has no owned 'extracted' helper rule before it`,
        );
        continue;
      }
      const referenced = [
        ...new Set([...note.matchAll(/([\w.-]+\.(?:ts|tsx|mts|mjs|js))\b/g)].map((m) => m[1])),
      ];
      if (referenced.length > 0 && !referenced.some((r) => earlierHelpers.includes(r))) {
        violations.push(
          `${module.id}: rule '${match}' (hookExtracted) references ${referenced.join(', ')} — ` +
            `none of them is an owned 'extracted' helper rule earlier in the module ` +
            `(available: ${earlierHelpers.join(', ')})`,
        );
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `hookExtracted pairing violations (${violations.length}):\n  ${violations.join('\n  ')}`,
  );
});
