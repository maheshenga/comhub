import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');
const readSource = (relativePath: string) =>
  readFileSync(path.resolve(repoRoot, relativePath), 'utf8');
const page = readSource('src/features/Admin/AdminModelBillingMatrixPage.tsx');
const matrixTable = readSource('src/features/Admin/ModelBillingMatrix/MatrixTable.tsx');
const saveHandlers = readSource('src/features/Admin/ModelBillingMatrix/useMatrixSaveHandlers.ts');

describe('admin model billing matrix experience', () => {
  it('uses the shared full-width page hierarchy with retry and responsive table states', () => {
    expect(page).toContain('AdminPageShell');
    expect(page).toContain('AdminPageError');
    expect(page).toContain('AdminSection');
    // Table hierarchy and form actions live in the split MatrixTable section.
    expect(matrixTable).toContain('AdminFormActions');
    expect(matrixTable).toContain('AdminResponsiveTable');
    expect(matrixTable).toContain('AdminSection');
    expect(page).toContain('hasLoadError');
    expect(page).toContain('refreshMatrixData');
    expect(page).not.toContain('padding={24}');
    expect(page).not.toContain('<Title');
    expect(page).not.toContain('<Card');
  });

  it('guards every write path until its required source data has loaded', () => {
    expect(saveHandlers).toContain('if (!canWriteSystem || !settings) return;');
    expect(saveHandlers).toContain('if (!canWriteSystem || !modelData || !settings) return;');
    expect(saveHandlers).toContain('if (!canWriteFinance || !planData) return;');
    // The guarded switches/buttons live in the split MatrixTable section.
    expect(matrixTable).toContain('disabled={!canWriteFinance || !planData || saving}');
    expect(matrixTable).toContain('disabled={!canWriteSystem || !settings || saving}');
  });

  it('retains matrix health, validation, access, and pricing behavior', () => {
    expect(page).toContain('getMatrixConfigHealth');
    expect(saveHandlers).toContain('findFreePlanDefaultModelConflict');
    expect(saveHandlers).toContain('setPlanModelRulesBatch');
    expect(saveHandlers).toContain('buildPricingRulesFromRows');
    expect(saveHandlers).toContain('validateDefaultAgentSettings');
  });
});
