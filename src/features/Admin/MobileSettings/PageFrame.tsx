'use client';

import { Alert, Button } from '@lobehub/ui/base-ui';

import { AdminFormActions, AdminPageError } from '../layout';
import { AdminPageState } from '../shared';

const LoadingShell = () => (
  <div data-testid="mobile-settings-loading">
    <AdminPageState loading skeletonVariant="detail">
      {null}
    </AdminPageState>
  </div>
);

export const MobileSettingsFeedback = ({
  error,
  loadPublication,
  success,
  validation,
}: {
  error?: string;
  loadPublication: () => Promise<void>;
  success?: string;
  validation: { messages: string[] };
}) => (
  <>
    {error ? <AdminPageError description={error} onRetry={loadPublication} /> : null}
    {success ? <Alert showIcon title={success} type="success" /> : null}
    {validation.messages.map((message) => (
      <Alert showIcon key={message} title={message} type="warning" />
    ))}
  </>
);

export const MobileSettingsActions = ({
  canPublish,
  canSave,
  publish,
  publishing,
  restoreDefaults,
  save,
  saving,
  tr,
}: {
  canPublish: boolean;
  canSave: boolean;
  publish: () => Promise<void>;
  publishing: boolean;
  restoreDefaults: () => void;
  save: () => Promise<void>;
  saving: boolean;
  tr: (key: string, defaultValue: string, values?: Record<string, unknown>) => string;
}) => (
  <AdminFormActions label={tr('admin.mobile.actions', '手机端配置操作')}>
    <Button onClick={() => restoreDefaults()}>
      {tr('admin.mobile.restoreDefaults', 'Restore defaults')}
    </Button>
    <Button disabled={!canSave} loading={saving} onClick={() => void save()}>
      {tr('admin.mobile.saveDraft', 'Save draft')}
    </Button>
    <Button
      disabled={!canPublish}
      loading={publishing}
      type="primary"
      onClick={() => void publish()}
    >
      {tr('admin.mobile.publish', 'Publish')}
    </Button>
  </AdminFormActions>
);

export { LoadingShell as MobileSettingsLoading };
