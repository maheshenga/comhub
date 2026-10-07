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

/**
 * Diff-line budget for every registry rule whose sync note marks an upstream
 * file delegating logic to a fork-owned extracted module: the canonical
 * "(hookExtracted)" tag plus the "(shared-helper extraction: …)" spelling for
 * delegates that share one owned helper (registry.test.mjs requires only that
 * the helper sits earlier in the same module, so tag wording may drift — both
 * spellings are budgeted so a delegate cannot escape the gate by re-tagging).
 * The delegation is only cheaper than keeping the logic inline while the
 * upstream file stays slim. This gate bounds the total diff (added + deleted)
 * vs the upstream baseline per rule path so a "delegate" cannot quietly grow
 * back into the inlined original.
 *
 * Why a loose total: numstat sums churn, and a pure re-indent (e.g. wrapping a
 * .catch block) inflates added+deleted with phantom lines, so the threshold is
 * a forgiving total, not a tight per-line budget.
 *
 * Measured baseline (2026-10-07, HEAD 453e7ea5ad49, sum of
 * `git diff --numstat v2.2.18 HEAD -- <rule path>`):
 *   327  apps/server/src/routers/lambda/image          (index.ts 269 + fork-new index.test.ts 58)
 *   232  apps/server/src/services/memory/userMemory/extract.ts
 *   224  apps/server/src/router-hono/workflows/task
 *   199  apps/server/src/services/generation
 *   156  apps/server/src/routers/lambda/video       (shares generationBillingGuard.ts helper with image)
 *   148  apps/server/src/globalConfig/index.ts
 *   127  apps/server/src/services/discover
 *    79  apps/server/src/routers/lambda/recent.ts
 *    71  src/store/aiInfra/slices/aiProvider/action.ts
 *    52  apps/server/src/services/market/index.ts
 *    48  apps/server/src/routers/lambda/userMemory.ts
 *    45  packages/database/src/repositories/aiInfra/index.ts
 *    39  apps/server/src/routers/lambda/usage.ts
 *    20  src/features/ChatInput/InputEditor/index.tsx
 *    18  packages/business-server/src/model-runtime.ts
 * max = 327 → ceil10(327 × 1.2) = 400 (never below the 300 floor).
 */
const HOOK_EXTRACTED_MAX_DIFF_LINES = 400;

// Note markers that pull an upstream rule path into the delegate diff budget:
// "(hookExtracted)" is the canonical tag; "(shared-helper extraction: …)" is
// the shared-helper spelling (several upstream delegates, one owned helper —
// routers/lambda/image and routers/lambda/video both delegate to
// generationBillingGuard.ts). Each matched rule path is budgeted individually.
const DELEGATE_NOTE_MARKER_RE = /\((?:hookExtracted|shared-helper extraction)\b/;

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

// Delegate diff budget: every rule noted "(hookExtracted)" or the shared-helper
// spelling "(shared-helper extraction: …)" gets its added+deleted churn vs the
// baseline summed (directory rules cover all files under them) and held under
// HOOK_EXTRACTED_MAX_DIFF_LINES.
const hookExtractedPaths = new Set();
for (const module of registryModules) {
  for (const [match, , note] of module.ownershipRules) {
    if (!note || !DELEGATE_NOTE_MARKER_RE.test(note)) continue;
    if (!match.startsWith('p:')) continue; // regex rules have no concrete path
    hookExtractedPaths.add(match.slice(2).replace(/\/$/, ''));
  }
}
const hookExtractedLines = new Map();
for (const hookPath of hookExtractedPaths) {
  const out = git(['diff', '--numstat', effectiveBaseline, 'HEAD', '--', hookPath]);
  let lines = 0;
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [added, deleted] = line.split('\t');
    lines += (Number(added) || 0) + (Number(deleted) || 0); // binary rows ("-") count 0
  }
  hookExtractedLines.set(hookPath, lines);
}
const hookExtractedOver = [...hookExtractedLines].filter(
  ([, lines]) => lines > HOOK_EXTRACTED_MAX_DIFF_LINES,
);
if (hookExtractedOver.length > 0) {
  failed = true;
  console.error(
    `\n✗ ${hookExtractedOver.length} hookExtracted delegate path(s) over the diff budget ` +
      `(${HOOK_EXTRACTED_MAX_DIFF_LINES} added+deleted lines vs ${effectiveBaseline}):`,
  );
  for (const [hookPath, lines] of hookExtractedOver) {
    console.error(`  ${String(lines).padStart(5)} / ${HOOK_EXTRACTED_MAX_DIFF_LINES}  ${hookPath}`);
  }
  console.error(
    `\n  A delegate file is growing back toward the inlined original. Move the new\n` +
      `  logic into the extracted fork-owned module, or — if the growth is genuinely\n` +
      `  delegate-shaped — raise HOOK_EXTRACTED_MAX_DIFF_LINES in this script and\n` +
      `  record the new per-file baseline in its comment.`,
  );
} else {
  console.log(
    `\nhookExtracted delegate diff budget (added+deleted vs ${effectiveBaseline}, max ${HOOK_EXTRACTED_MAX_DIFF_LINES}):`,
  );
  for (const [hookPath, lines] of [...hookExtractedLines].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(lines).padStart(5)}  ${hookPath}`);
  }
}

if (failed) process.exit(1);

console.log(`\n✓ all changed files are registered; upstream rule paths exist.`);
