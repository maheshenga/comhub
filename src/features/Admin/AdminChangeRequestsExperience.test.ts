import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const page = readFileSync(
  path.resolve(__dirname, '../../..', 'src/features/Admin/AdminChangeRequestsPage.tsx'),
  'utf8',
);

const bulkToolbar = readFileSync(
  path.resolve(__dirname, '../../..', 'src/features/Admin/ChangeRequests/BulkActionsToolbar.tsx'),
  'utf8',
);

describe('admin change requests experience', () => {
  it('uses shared page hierarchy, retry state, and responsive table navigation', () => {
    expect(page).toContain('AdminPageShell');
    expect(page).toContain('AdminPageError');
    expect(page).toContain('AdminSection');
    expect(page).toContain('AdminToolbar');
    expect(page).toContain('AdminResponsiveTable');
    expect(page).toContain('onRetry={mutate}');
    expect(page).not.toContain('padding={24}');
  });

  it('keeps approval, rejection, bulk confirmation, and selection reset behavior', () => {
    expect(bulkToolbar).toContain('AdminBulkActionFlow');
    expect(bulkToolbar).toContain('actionId="subscription.changeRequest.bulkApprove"');
    expect(bulkToolbar).toContain('actionId="subscription.changeRequest.bulkReject"');
    expect(page).toContain('setSelectedIds([])');
    expect(page).toContain('handleRejectConfirm');
  });
});
