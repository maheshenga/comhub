#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { buildUpstreamFeatureAudit, renderUpstreamFeatureAuditReport } from './core.mjs';

const DEFAULT_REPORT_DIR = 'docs/development/upstream-sync-reports';

const options = parseArgs(process.argv.slice(2));
const root = process.cwd();
const baseRef = options.baseRef || process.env.COMHUB_AUDIT_BASE_REF || 'v2.2.6';
const upstreamRef = options.upstreamRef || process.env.COMHUB_AUDIT_UPSTREAM_REF || 'v2.2.9';
const currentRef = options.currentRef || process.env.COMHUB_AUDIT_CURRENT_REF || 'HEAD';
const reportPath = path.resolve(
  root,
  options.reportPath ||
    process.env.COMHUB_AUDIT_REPORT_PATH ||
    path.join(
      DEFAULT_REPORT_DIR,
      `feature-audit-${sanitizeRef(baseRef)}-${sanitizeRef(upstreamRef)}.md`,
    ),
);

const audit = buildUpstreamFeatureAudit({
  currentTreeOutput: git(['ls-tree', '-r', currentRef]),
  targetToHeadNameStatusOutput: git(['diff', '--name-status', upstreamRef, currentRef]),
  upstreamAddedFiles: git(['diff', '--name-only', '--diff-filter=A', baseRef, upstreamRef])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean),
  upstreamModifiedRawDiffOutput: git(['diff', '--raw', '--diff-filter=M', baseRef, upstreamRef]),
});

const report = renderUpstreamFeatureAuditReport({
  audit,
  baseRef,
  currentRef,
  generatedAt: new Date().toISOString(),
  upstreamRef,
});

mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, report);

console.log(
  `Feature audit report written: ${path.relative(root, reportPath).replaceAll('\\', '/')}`,
);
console.log(`Missing upstream-added files: ${audit.missingAddedFiles.length}`);
console.log(`Stale upstream-modified files: ${audit.staleModifiedFiles.length}`);
console.log(`Renamed or re-homed upstream files: ${audit.renamedMissingFiles.length}`);
console.log(`Migration metadata files: ${audit.migrationMetadataFiles.length}`);

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const next = () => {
      index++;
      if (index >= args.length) throw new Error(`Missing value for ${arg}`);

      return args[index];
    };

    if (arg === '--base-ref') parsed.baseRef = next();
    else if (arg === '--current-ref') parsed.currentRef = next();
    else if (arg === '--report-path') parsed.reportPath = next();
    else if (arg === '--upstream-ref') parsed.upstreamRef = next();
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function sanitizeRef(value) {
  return value
    .replaceAll(/[^\w.-]/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
