'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Button } from '@lobehub/ui';
import { Form, useForm } from '@lobehub/ui/form';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';

import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { useUnsavedChangesGuard } from '../../../shared/useUnsavedChangesGuard';
import ActionEditor from '../../ActionEditor';
import { type ModuleAppAdminFormValues, normalizeModuleAppFormValues } from '../../formSchema';
import type { ModuleAppDetailOutletContext } from '../../layouts/ModuleAppDetailLayout';
import PageEditor from '../../PageEditor';
import {
  clearModuleDraft,
  createModuleDraftScope,
  loadModuleDraft,
  saveModuleDraft,
} from '../../shared/draftStorage';
import { detailSubPageStyles as styles } from '../detailSubPageStyles';

type ConfigurationDraft = Pick<ModuleAppAdminFormValues, 'actions' | 'pages'>;

const normalizeConfigurationDraft = (values: ConfigurationDraft): ConfigurationDraft => {
  const normalized = normalizeModuleAppFormValues(values);

  return {
    actions: normalized.actions,
    pages: values.pages.length === 0 ? [] : normalized.pages,
  };
};

const ModuleAppConfigurationPage = memo(() => {
  const { t } = useTranslation('common');
  const { app, refresh } = useOutletContext<ModuleAppDetailOutletContext>();
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const canWrite = hasAdminCapability(role, ADMIN_CAPABILITIES.moduleAppWrite);
  const form = useForm<ConfigurationDraft>({
    onSubmit: (values) => save(values),
    onValuesChange: () => {
      if (!canWrite) return;

      setDirty(true);
      persistDraft();
    },
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>();
  const draftScope = createModuleDraftScope(app.id, 'configuration');

  useUnsavedChangesGuard({
    cancelText: t('moduleApps.admin.center.unsavedCancel'),
    confirmText: t('moduleApps.admin.center.unsavedDiscard'),
    isDirty: dirty,
    message: t('moduleApps.admin.center.unsavedConfirmation'),
    title: t('moduleApps.admin.center.unsavedTitle'),
  });

  useEffect(() => {
    const draft = loadModuleDraft<ConfigurationDraft>(draftScope);
    const sourcePages = draft?.pages ?? app.pages;
    const values = normalizeModuleAppFormValues({
      actions: draft?.actions ?? app.actions,
      pages: sourcePages,
    });
    form.setValues({
      actions: values.actions,
      pages: sourcePages.length === 0 ? [] : values.pages,
    });
    setDirty(Boolean(draft));
    setSaveStatus(draft ? t('moduleApps.admin.configuration.draftRestored') : undefined);
  }, [app.actions, app.pages, draftScope, form, t]);

  const persistDraft = () => {
    if (!canWrite) return;

    const values = form.getValues();
    try {
      saveModuleDraft(draftScope, normalizeConfigurationDraft(values));
    } catch {
      setSaveStatus(t('moduleApps.admin.configuration.draftRejected'));
    }
  };

  async function save(values: ConfigurationDraft) {
    if (!canWrite) return;

    let normalized: ConfigurationDraft;
    try {
      normalized = normalizeConfigurationDraft(values);
    } catch {
      setSaveStatus(t('moduleApps.admin.configuration.validationError'));
      return;
    }
    try {
      saveModuleDraft(draftScope, normalized);
    } catch {
      setSaveStatus(t('moduleApps.admin.configuration.draftRejected'));
      return;
    }
    const actions = normalized.actions.map(
      ({
        inputSchemaJson: _inputSchemaJson,
        outputSchemaJson: _outputSchemaJson,
        runtimeConfigJson: _runtimeConfigJson,
        ...action
      }) => action,
    );
    const pages = normalized.pages.map(
      ({
        actionBindingsJson: _actionBindingsJson,
        dataSourceJson: _dataSourceJson,
        layoutSchemaJson: _layoutSchemaJson,
        ...page
      }) => page,
    );
    setSaving(true);
    setSaveStatus(undefined);

    try {
      if (!app.versionId) throw new Error('MODULE_APP_VERSION_NOT_FOUND');
      await adminCommercialService.moduleApps.upsertConfiguration({
        actions,
        appId: app.id,
        expectedVersionId: app.versionId,
        pages,
      });
    } catch (error) {
      const candidate = error as { data?: { code?: string }; message?: string } | undefined;
      const conflict =
        candidate?.data?.code === 'CONFLICT' ||
        candidate?.message?.includes('MODULE_APP_CONFIGURATION_CONFLICT');
      setSaveStatus(
        t(
          conflict
            ? 'moduleApps.admin.configuration.conflict'
            : 'moduleApps.admin.configuration.saveFailed',
        ),
      );
      return;
    } finally {
      setSaving(false);
    }

    clearModuleDraft(draftScope);
    setDirty(false);
    setSaveStatus(t('moduleApps.admin.configuration.saved'));
    await refresh();
  }

  return (
    <section className={styles.page} data-testid="module-app-configuration">
      <header className={styles.header} data-testid="module-app-configuration-header">
        <div>
          <h2 className={styles.title}>{t('moduleApps.admin.configuration.title')}</h2>
          <p className={styles.description}>{t('moduleApps.admin.configuration.description')}</p>
        </div>
      </header>
      <Form<ConfigurationDraft> form={form} layout="vertical">
        <PageEditor disabled={!canWrite} />
        <ActionEditor disabled={!canWrite} />
        {saveStatus ? <p role="status">{saveStatus}</p> : null}
        {canWrite ? (
          <Button htmlType="submit" loading={saving} type="primary">
            {t('moduleApps.admin.configuration.save')}
          </Button>
        ) : null}
      </Form>
    </section>
  );
});

ModuleAppConfigurationPage.displayName = 'ModuleAppConfigurationPage';

export default ModuleAppConfigurationPage;
