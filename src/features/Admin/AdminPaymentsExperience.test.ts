import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(path.resolve(__dirname, '../../..', relativePath), 'utf8');
const page = readSource('src/features/Admin/AdminPaymentsPage.tsx');
const channelSettings = readSource('src/features/Admin/PaymentChannels/ChannelSettings.tsx');

describe('admin payment center experience', () => {
  it('uses the shared page shell, recoverable settings error, and stable save actions', () => {
    expect(page).toContain('AdminPageShell');
    // Settings error/skeleton/save actions live in the split ChannelSettings.
    expect(channelSettings).toContain('AdminPageError');
    expect(channelSettings).toContain('AdminFormActions');
    expect(channelSettings).toContain('onRetry={settings.mutate}');
    expect(channelSettings).toContain('Skeleton active');
    expect(page).not.toContain('padding={24}');
    expect(page).not.toContain('<Title');
  });

  it('retains payment permissions, settings ownership, secret handling, and tab routing', () => {
    expect(page).toContain('ADMIN_CAPABILITIES.systemRead');
    expect(page).toContain('ADMIN_CAPABILITIES.financeRead');
    expect(channelSettings).toContain('SECRET_FIELDS');
    expect(channelSettings).toContain('FIELD_KEYS');
    expect(channelSettings).toContain("ADMIN_SETTINGS_SECTION_SWR_KEY('payments')");
    expect(page).toContain('useUnsavedChangesGuard');
    expect(page).toContain('PAYMENT_CENTER_TABS');
    expect(channelSettings).toContain('legacyEnvironmentKeys');
    expect(channelSettings).toContain('admin.payments.legacyEnvironment.title');
  });
});
