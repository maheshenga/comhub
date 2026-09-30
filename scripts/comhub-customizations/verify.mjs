#!/usr/bin/env node
/**
 * Customization registry verification gate.
 *
 * Fails when:
 * 1. A file changed vs the upstream baseline is not claimed by any registry
 *    module (unregistered upstream-file edit → must be added to the registry).
 * 2. A registry "upstream"-owned path no longer exists (upstream deleted or
 *    renamed it — the sync note must be revisited).
 * 3. A file claimed "upstream" is actually absent from the diff AND the file
 *    no longer differs (module claims are stale the other way) — reported as
 *    info only, not a failure (owned-dir rules legitimately over-cover).
 *
 * Usage: node scripts/comhub-customizations/verify.mjs [--baseline v2.2.18]
 * Env:   COMHUB_UPSTREAM_BASELINE overrides the baseline tag/commit.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');

const baselineArgIndex = process.argv.indexOf('--baseline');
const baseline =
  (baselineArgIndex >= 0 && process.argv[baselineArgIndex + 1]) ||
  process.env.COMHUB_UPSTREAM_BASELINE ||
  'v2.2.18';

const { UPSTREAM_BASELINE_TAG, registryModules, findModuleForPath } = await import(
  new URL('./registry.mjs', import.meta.url).href
);

const effectiveBaseline = baseline || UPSTREAM_BASELINE_TAG;

const git = (args) =>
  execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const parseNameStatus = (output) => {
  const files = [];
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const status = line.slice(0, tab);
    let path = line.slice(tab + 1);
    if (status.startsWith('R') || status.startsWith('C')) {
      const parts = path.split('\t');
      path = parts.at(-1);
    }
    files.push({ path, status });
  }
  return files;
};

const baselineOk = (() => {
  try {
    git(['rev-parse', '--verify', `${effectiveBaseline}^{commit}`]);
    return true;
  } catch {
    return false;
  }
})();

if (!baselineOk) {
  console.error(
    `✗ upstream baseline ref "${effectiveBaseline}" not found in this checkout.\n` +
      `  Fetch upstream tags first (see docs/development/comhub-upstream-customizations.md)\n` +
      `  or pass --baseline <tag|commit>.`,
  );
  process.exit(2);
}

const diff = parseNameStatus(git(['diff', '--name-status', `${effectiveBaseline}`, 'HEAD']));

const unregistered = [];
const claimedFiles = new Map();
for (const file of diff) {
  const hit = findModuleForPath(file.path);
  if (!hit) {
    unregistered.push(file);
    continue;
  }
  if (!claimedFiles.has(hit.module.id)) claimedFiles.set(hit.module.id, []);
  claimedFiles.get(hit.module.id).push({ ...file, ownership: hit.ownership });
}

// Every rule path marked "upstream" must exist in the working tree (it may be
// unmodified vs baseline — the rule then covers future edits). Rules may name
// a file without its extension (errorResponse → errorResponse.ts); probe both.
const missingUpstreamPaths = [];
const rulePathCache = new Map();
const pathExists = (path) => {
  const absolute = resolve(repoRoot, path);
  if (existsSync(absolute)) return true;
  const candidates = ['.ts', '.tsx', '.mjs', '.mts', '.js', '.json', '.yml', '.yaml'];
  return candidates.some((ext) => existsSync(`${absolute}${ext}`));
};
for (const module of registryModules) {
  for (const [match, ownership] of module.ownershipRules) {
    if (ownership !== 'upstream') continue;
    if (!match.startsWith('p:')) continue; // regex rules are patterns, skip
    const path = match.slice(2).replace(/\/$/, '');
    const key = `${module.id}:${path}`;
    if (rulePathCache.has(key)) continue;
    rulePathCache.set(key, pathExists(path));
  }
}
for (const [key, ok] of rulePathCache) {
  if (!ok) missingUpstreamPaths.push(key);
}

const moduleSummary = registryModules
  .map((module) => {
    const files = claimedFiles.get(module.id) ?? [];
    const owned = files.filter((f) => f.ownership === 'owned').length;
    const upstream = files.filter((f) => f.ownership === 'upstream').length;
    return { id: module.id, owned, sync: module.sync, total: files.length, upstream };
  })
  .filter((m) => m.total > 0)
  .sort((a, b) => b.total - a.total);

console.log(`ComHub customization registry verification`);
console.log(`  baseline: ${effectiveBaseline} (registry default ${UPSTREAM_BASELINE_TAG})`);
console.log(`  changed files vs baseline: ${diff.length}`);
console.log(`  claimed by modules:        ${diff.length - unregistered.length}`);
console.log(`  modules touched:           ${moduleSummary.length}`);
for (const m of moduleSummary) {
  console.log(
    `    ${m.id.padEnd(24)} total=${String(m.total).padStart(4)} owned=${String(m.owned).padStart(4)} upstream=${String(m.upstream).padStart(4)} sync=${m.sync}`,
  );
}

let failed = false;

if (unregistered.length > 0) {
  failed = true;
  console.error(`\n✗ ${unregistered.length} changed file(s) not claimed by any registry module:`);
  for (const f of unregistered) console.error(`  ${f.status}\t${f.path}`);
  console.error(
    `\n  Add the file to scripts/comhub-customizations/registry.mjs (correct module +\n` +
      `  ownership) before merging. Fork-owned dirs should claim their new files with\n` +
      `  an "owned" rule; edits to upstream files need an "upstream" rule and a sync note.`,
  );
}

if (missingUpstreamPaths.length > 0) {
  failed = true;
  console.error(
    `\n✗ ${missingUpstreamPaths.length} registry "upstream" path(s) missing from the tree:`,
  );
  for (const key of missingUpstreamPaths) console.error(`  ${key}`);
  console.error(
    `\n  Upstream deleted/renamed these paths. Update the owning module's rules\n` +
      `  (re-point to the new path, or fold into the new owner module).`,
  );
}

if (failed) process.exit(1);

console.log(`\n✓ all changed files are registered; upstream rule paths exist.`);
