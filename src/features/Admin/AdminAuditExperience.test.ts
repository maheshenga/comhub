import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.resolve(__dirname, 'Audit/AdminAuditPage.tsx');
const routeShimPath = path.resolve(__dirname, '../../routes/(main)/admin/audit/index.tsx');

describe('AdminAuditPage experience contract', () => {
  it('uses shared feedback states and keeps filters responsive', () => {
    const page = fs.readFileSync(pagePath, 'utf8');

    expect(page).toContain('AdminPageShell');
    expect(page).toContain('AdminPageError');
    expect(page).toContain('AdminSection');
    expect(page).toContain('onRetry={refresh}');
  });

  it('stays a thin route shim after the M5 page split', () => {
    const shim = fs.readFileSync(routeShimPath, 'utf8');

    expect(shim).toContain("import AdminAuditPage from '@/features/Admin/Audit/AdminAuditPage'");
    expect(shim).toContain('export default AdminAuditPage');
  });

  it('exposes the M5 batch task visualization surface', () => {
    const page = fs.readFileSync(pagePath, 'utf8');
    const parts = fs.readFileSync(path.resolve(__dirname, 'Audit/auditParts.tsx'), 'utf8');

    expect(page).toContain('batchCorrelationId: batchFilter || undefined');
    expect(parts).toContain('groupAuditRowsByBatch');
    expect(parts).toContain('readBatchCorrelationId');
    expect(parts).toContain('批量任务 {{count}} 条');
  });
});

