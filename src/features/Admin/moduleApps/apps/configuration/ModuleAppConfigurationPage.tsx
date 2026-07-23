'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Button } from '@lobehub/ui/base-ui';
import { Form } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';

import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

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
import { useUnsavedChangesGuard } from '../../shared/useUnsavedChangesGuard';

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
  const [form] = Form.useForm<ConfigurationDraft>();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>();
  const draftScope = createModuleDraftScope(app.id, 'configuration');

  useUnsavedChangesGuard(dirty, t('moduleApps.admin.center.unsavedConfirmation'));

  useEffect(() => {
    const draft = loadModuleDraft<ConfigurationDraft>(draftScope);
    const sourcePages = draft?.pages ?? app.pages;
    const values = normalizeModuleAppFormValues({
      ...app,
      actions: draft?.actions ?? app.actions,
      pages: sourcePages,
    });
    form.setFieldsValue({
      actions: values.actions,
      pages: sourcePages.length === 0 ? [] : values.pages,
    });
    setDirty(Boolean(draft));
    setSaveStatus(draft ? t('moduleApps.admin.configuration.draftRestored') : undefined);
  }, [app.id, draftScope, form, t]);

  const persistDraft = () => {
    if (!canWrite) return;

    const values = form.getFieldsValue(true);
    try {
      saveModuleDraft(draftScope, normalizeConfigurationDraft(values));
    } catch {
      setSaveStatus(t('moduleApps.admin.configuration.draftRejected'));
    }
  };

  const save = async () => {
    if (!canWrite) return;

    const values = await form.validateFields();
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
      ({ inputSchemaJson, outputSchemaJson, runtimeConfigJson, ...action }) => action,
    );
    const pages = normalized.pages.map(
      ({ actionBindingsJson, dataSourceJson, layoutSchemaJson, ...page }) => page,
    );
    const accepted: string[] = [];
    const failed: string[] = [];
    setSaving(true);
    setSaveStatus(undefined);

    try {
      await adminCommercialService.moduleApps.upsertPages({ appId: app.id, pages });
      accepted.push(t('moduleApps.admin.configuration.pages'));
    } catch {
      failed.push(t('moduleApps.admin.configuration.pages'));
    }

    try {
      await adminCommercialService.moduleApps.upsertActions({
        actions,
        appId: app.id,
      });
      accepted.push(t('moduleApps.admin.configuration.actions'));
    } catch {
      failed.push(t('moduleApps.admin.configuration.actions'));
    } finally {
      setSaving(false);
    }

    if (failed.length) {
      setSaveStatus(
        t('moduleApps.admin.configuration.partialSave', {
          accepted: accepted.join(', ') || t('moduleApps.admin.configuration.none'),
          failed: failed.join(', '),
        }),
      );
      return;
    }

    clearModuleDraft(draftScope);
    setDirty(false);
    setSaveStatus(t('moduleApps.admin.configuration.saved'));
    await refresh();
  };

  return (
    <section data-testid="module-app-configuration">
      <header>
        <h2>{t('moduleApps.admin.configuration.title')}</h2>
        <p>{t('moduleApps.admin.configuration.description')}</p>
      </header>
      <Form<ConfigurationDraft>
        disabled={!canWrite}
        form={form}
        layout="vertical"
        onFinish={save}
        onValuesChange={() => {
          if (!canWrite) return;

          setDirty(true);
          persistDraft();
        }}
      >
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
