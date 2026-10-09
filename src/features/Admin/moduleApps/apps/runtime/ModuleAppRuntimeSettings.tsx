'use client';

import { Button, Switch, toast } from '@lobehub/ui/base-ui';
import { RotateCcw, Save } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ADMIN_SETTINGS_SECTION_SWR_KEY } from '@/const/adminCacheKeys';
import { APP_SETTING_KEYS } from '@/const/appSettingsRegistry';
import { mutate } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { moduleAppCacheKeys } from '../../shared/cacheKeys';
import type { ModuleAppRuntimeSettingsData } from '../../types';
import {
  buildRuntimeSettingUpdates,
  runtimeSettingsStyles as styles,
  type RuntimeSettingsForm,
} from './runtimeSettingsShared';

const buildFormValues = (settings: ModuleAppRuntimeSettingsData): RuntimeSettingsForm => ({
  executionEnabled: settings.requestedSwitches.executionEnabled,
  internalToken: '',
  internalUrl: settings.internalUrl,
  invocationEnabled: settings.requestedSwitches.invocationEnabled,
  publicExecutionEnabled: settings.requestedSwitches.publicExecutionEnabled,
  publicOrigin: settings.publicOrigin,
  scheduleDispatchEnabled: settings.requestedSwitches.scheduleDispatchEnabled,
  workflowPrivilegedExecutorsEnabled: settings.requestedSwitches.workflowPrivilegedExecutorsEnabled,
});

const SwitchRow = ({
  checked,
  description,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) => (
  <label className={styles.switchRow}>
    <span className={styles.switchText}>
      <strong>{label}</strong>
      <span>{description}</span>
    </span>
    <Switch aria-label={label} checked={checked} disabled={disabled} onChange={onChange} />
  </label>
);

const RUNTIME_ERROR_KEYS = [
  'MODULE_APP_PUBLIC_EXECUTION_REQUIRES_EXECUTION',
  'MODULE_APP_PUBLIC_EXECUTION_CONFIG_REQUIRED',
  'MODULE_APP_RUNTIME_INVOCATION_REQUIRES_EXECUTION',
  'MODULE_APP_RUNTIME_INVOCATION_CONFIG_REQUIRED',
  'MODULE_APP_RUNTIME_CONFIG_SOURCE_MISMATCH',
  'MODULE_APP_RUNTIME_AUTH_FAILED',
  'MODULE_APP_RUNTIME_NOT_READY',
  'MODULE_APP_SCHEDULE_DISPATCH_REQUIRES_EXECUTION',
  'MODULE_APP_WORKFLOW_EXECUTORS_REQUIRE_EXECUTION',
];

const ModuleAppRuntimeSettings = memo<{
  canWrite?: boolean;
  settings: ModuleAppRuntimeSettingsData;
}>(({ canWrite = true, settings }) => {
  const { t: translate } = useTranslation('common');
  const t = (key: string, options?: Record<string, unknown>) =>
    translate(key as any, options as any);
  const resolvedInitialValues = useMemo(() => buildFormValues(settings), [settings]);
  const [initialValues, setInitialValues] = useState(resolvedInitialValues);
  const [values, setValues] = useState(resolvedInitialValues);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setInitialValues(resolvedInitialValues);
    setValues(resolvedInitialValues);
  }, [resolvedInitialValues]);

  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues);
  const tokenAvailable = settings.internalTokenConfigured || Boolean(values.internalToken.trim());
  const internalConnectionReady = Boolean(values.internalUrl.trim()) && tokenAvailable;
  const publicConnectionReady = internalConnectionReady && Boolean(values.publicOrigin.trim());
  const requestedBlocked = Object.entries(settings.requestedSwitches).some(
    ([key, enabled]) =>
      enabled && !settings.switches[key as keyof ModuleAppRuntimeSettingsData['switches']],
  );

  const setValue = <Key extends keyof RuntimeSettingsForm>(
    key: Key,
    value: RuntimeSettingsForm[Key],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const setExecutionEnabled = (enabled: boolean) =>
    setValues((current) => ({
      ...current,
      executionEnabled: enabled,
      ...(!enabled
        ? {
            invocationEnabled: false,
            publicExecutionEnabled: false,
            scheduleDispatchEnabled: false,
            workflowPrivilegedExecutorsEnabled: false,
          }
        : {}),
    }));

  const save = async () => {
    if (!canWrite) return;
    setSubmitting(true);
    try {
      await adminCommercialService.setModuleAppRuntimeSettings({
        updates: buildRuntimeSettingUpdates(values, APP_SETTING_KEYS),
      });
      await Promise.all([
        mutate(ADMIN_SETTINGS_SECTION_SWR_KEY('module-runtime')),
        mutate(moduleAppCacheKeys.runtimeDiagnostics()),
      ]);
      const nextValues = { ...values, internalToken: '' };
      setInitialValues(nextValues);
      setValues(nextValues);
      toast.success(t('moduleApps.admin.runtime.settings.saved'));
    } catch (error) {
      const known = error instanceof Error && RUNTIME_ERROR_KEYS.includes(error.message);
      toast.error(
        t(
          known
            ? `moduleApps.admin.runtime.settings.errors.${(error as Error).message}`
            : 'moduleApps.admin.runtime.settings.saveFailed',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fieldDisabled = submitting || !canWrite;

  return (
    <div className={styles.panel} data-testid="module-runtime-settings">
      {settings.source.legacyEnvironmentKeys.length > 0 ? (
        <p className={styles.notice} role="status">
          {t('moduleApps.admin.runtime.settings.environmentFallback', {
            count: settings.source.legacyEnvironmentKeys.length,
          })}
        </p>
      ) : null}
      {requestedBlocked ? (
        <p className={styles.notice} role="status">
          {t('moduleApps.admin.runtime.settings.safetyBlocked')}
        </p>
      ) : null}
      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span className={styles.label}>{t('moduleApps.admin.runtime.settings.internalUrl')}</span>
          <input
            className={styles.input}
            disabled={fieldDisabled}
            type="url"
            value={values.internalUrl}
            onChange={(event) => setValue('internalUrl', event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>
            {t('moduleApps.admin.runtime.settings.publicOrigin')}
          </span>
          <input
            className={styles.input}
            disabled={fieldDisabled}
            type="url"
            value={values.publicOrigin}
            onChange={(event) => setValue('publicOrigin', event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>
            {t('moduleApps.admin.runtime.settings.internalToken')}
          </span>
          <input
            autoComplete="new-password"
            className={styles.input}
            disabled={fieldDisabled}
            placeholder={settings.internalTokenMasked ?? undefined}
            type="password"
            value={values.internalToken}
            onChange={(event) => setValue('internalToken', event.target.value)}
          />
          <span className={styles.secretHint}>
            {t(
              settings.internalTokenConfigured
                ? 'moduleApps.admin.runtime.settings.internalTokenConfigured'
                : 'moduleApps.admin.runtime.settings.internalTokenMissing',
            )}
          </span>
        </label>
      </div>
      <div className={styles.switchGrid}>
        <SwitchRow
          checked={values.executionEnabled}
          description={t('moduleApps.admin.runtime.settings.executionDescription')}
          disabled={fieldDisabled}
          label={t('moduleApps.admin.runtime.settings.execution')}
          onChange={setExecutionEnabled}
        />
        <SwitchRow
          checked={values.publicExecutionEnabled}
          description={t('moduleApps.admin.runtime.settings.publicExecutionDescription')}
          label={t('moduleApps.admin.runtime.settings.publicExecution')}
          disabled={
            fieldDisabled ||
            (!values.publicExecutionEnabled && (!values.executionEnabled || !publicConnectionReady))
          }
          onChange={(checked) => setValue('publicExecutionEnabled', checked)}
        />
        <SwitchRow
          checked={values.invocationEnabled}
          description={t('moduleApps.admin.runtime.settings.invocationDescription')}
          label={t('moduleApps.admin.runtime.settings.invocation')}
          disabled={
            fieldDisabled ||
            (!values.invocationEnabled && (!values.executionEnabled || !internalConnectionReady))
          }
          onChange={(checked) => setValue('invocationEnabled', checked)}
        />
        <SwitchRow
          checked={values.scheduleDispatchEnabled}
          description={t('moduleApps.admin.runtime.settings.scheduleDescription')}
          label={t('moduleApps.admin.runtime.settings.schedule')}
          disabled={fieldDisabled || (!values.scheduleDispatchEnabled && !values.executionEnabled)}
          onChange={(checked) => setValue('scheduleDispatchEnabled', checked)}
        />
        <SwitchRow
          checked={values.workflowPrivilegedExecutorsEnabled}
          description={t('moduleApps.admin.runtime.settings.workflowDescription')}
          label={t('moduleApps.admin.runtime.settings.workflow')}
          disabled={
            fieldDisabled || (!values.workflowPrivilegedExecutorsEnabled && !values.executionEnabled)
          }
          onChange={(checked) => setValue('workflowPrivilegedExecutorsEnabled', checked)}
        />
      </div>
      <p className={styles.description}>{t('moduleApps.admin.runtime.settings.description')}</p>
      <div className={styles.actions}>
        <Button
          disabled={!canWrite || !dirty || submitting}
          icon={Save}
          loading={submitting}
          type="primary"
          onClick={() => void save()}
        >
          {t('moduleApps.admin.runtime.settings.save')}
        </Button>
        <Button
          disabled={!canWrite || !dirty || submitting}
          icon={RotateCcw}
          onClick={() => setValues(initialValues)}
        >
          {t('moduleApps.admin.runtime.settings.reset')}
        </Button>
      </div>
    </div>
  );
});

ModuleAppRuntimeSettings.displayName = 'ModuleAppRuntimeSettings';

export default ModuleAppRuntimeSettings;
