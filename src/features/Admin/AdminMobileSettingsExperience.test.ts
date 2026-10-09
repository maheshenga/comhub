import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(path.resolve(__dirname, '../../..', relativePath), 'utf8');
const page = readSource('src/features/Admin/AdminMobileSettingsPage.tsx');
const pageFrame = readSource('src/features/Admin/MobileSettings/PageFrame.tsx');
const historySection = readSource(
  'src/features/Admin/MobileSettings/PublicationHistorySection.tsx',
);

describe('admin mobile settings experience', () => {
  it('uses the shared page shell, recoverable load state, and sticky action region', () => {
    expect(page).toContain('AdminPageShell');
    expect(page).toContain('MobileSettingsFeedback');
    expect(pageFrame).toContain('AdminPageError');
    expect(page).toContain('MobileSettingsActions');
    expect(pageFrame).toContain('AdminFormActions');
    expect(page).toContain('loadPublication');
    expect(page).toContain('loadPublication={loadPublication}');
    expect(pageFrame).toContain('onRetry={loadPublication}');
    expect(page).not.toContain('styles.page');
    expect(page).not.toContain('styles.actionRow');
  });

  it('retains draft, publish, rollback, validation, and unsaved navigation behavior', () => {
    expect(page).toContain('useMobilePublicationActions');
    expect(page).toContain('useUnsavedChangesGuard');
    expect(page).toContain('restoreDefaults');
    // History rendering lives in the split PublicationHistorySection.
    expect(historySection).toContain('publicationState.history.map');
    expect(page).toContain('PublicationHistorySection');
    expect(pageFrame).toContain('validation.messages.map');
  });
});
