'use client';

import { Flexbox } from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DEFAULT_MOBILE_CONFIG,
  type MobilePublicConfigV1,
  normalizeMobileConfig,
} from '@/const/mobileConfig';
import {
  createMobileConfigPublication,
  type MobileConfigPublicationState,
} from '@/const/mobileConfigPublication';
import { adminCommercialService } from '@/services/adminCommercial';

import { AdminPageShell } from './layout';
import {
  ApplicationsSection,
  BottomNavigationSection,
  BrandSection,
  DesignToolsSection,
  DiscoverCommunitySection,
  FeaturedAssistantsSection,
} from './MobileSettings';
import {
  MobileSettingsActions,
  MobileSettingsFeedback,
  MobileSettingsLoading,
} from './MobileSettings/PageFrame';
import PreviewSection from './MobileSettings/PreviewSection';
import PublicationHistorySection from './MobileSettings/PublicationHistorySection';
import { useMobilePublicationActions } from './MobileSettings/useMobilePublicationActions';
import { useMobileSelectorOptions } from './MobileSettings/useMobileSelectorOptions';
import {
  cloneConfig,
  createMobileSettingsAsyncGuard,
  stringifyConfig,
  toFormConfig,
  validateFormConfig,
} from './mobileSettingsHelpers';
import { useUnsavedChangesGuard } from './shared/useUnsavedChangesGuard';

const AdminMobileSettingsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const tr = useCallback(
    (key: string, defaultValue: string, values: Record<string, unknown> = {}) =>
      String(t(key as any, { defaultValue, ...values })),
    [t],
  );
  const asyncGuardRef = useRef<ReturnType<typeof createMobileSettingsAsyncGuard> | null>(null);
  if (!asyncGuardRef.current) asyncGuardRef.current = createMobileSettingsAsyncGuard();
  const asyncGuard = asyncGuardRef.current;
  const [formValues, setFormValues] = useState<MobilePublicConfigV1>(() =>
    cloneConfig(DEFAULT_MOBILE_CONFIG),
  );
  const [baseline, setBaseline] = useState<MobilePublicConfigV1>(() =>
    cloneConfig(DEFAULT_MOBILE_CONFIG),
  );
  const [publicationState, setPublicationState] = useState<MobileConfigPublicationState>(() =>
    createMobileConfigPublication(DEFAULT_MOBILE_CONFIG, new Date(0).toISOString()),
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const loadPublication = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const publication = await adminCommercialService.getMobileSettingsPublication();
      const normalized = toFormConfig(publication.draft.config);
      if (!asyncGuard.isMounted()) return;
      setPublicationState(publication);
      setFormValues(normalized);
      setBaseline(normalized);
    } catch {
      if (asyncGuard.isMounted()) {
        setError(tr('admin.mobile.loadError', 'Failed to load mobile settings.'));
      }
    } finally {
      if (asyncGuard.isMounted()) setLoading(false);
    }
  }, [asyncGuard, tr]);

  const {
    assistantOptions,
    assistantStatus,
    modelOptions,
    modelStatus,
    moduleAppOptions,
    moduleAppStatus,
    refreshAssistantOptions,
    refreshModelOptions,
    refreshModuleAppOptions,
    selectedAssistantId,
    selectedModelValue,
    selectedModuleAppId,
    setSelectedAssistantId,
    setSelectedModelValue,
    setSelectedModuleAppId,
  } = useMobileSelectorOptions({ asyncGuard, tr });
  useEffect(() => {
    asyncGuard.mount();
    void loadPublication();
    return () => asyncGuard.unmount();
  }, [asyncGuard, loadPublication]);

  const normalizedPreview = useMemo(() => normalizeMobileConfig(formValues), [formValues]);
  const validation = useMemo(
    () =>
      validateFormConfig(formValues, {
        builtinPaths: tr(
          'admin.mobile.validation.builtinPaths',
          'Built-in app paths must be internal.',
        ),
        uniquePaths: tr(
          'admin.mobile.validation.uniquePaths',
          'Visible tab paths must be internal and unique.',
        ),
      }),
    [formValues, tr],
  );
  const dirty = stringifyConfig(formValues) !== stringifyConfig(baseline);
  const canSaveReady = dirty && !loading && validation.valid;
  const draftDiffersFromPublished =
    stringifyConfig(baseline) !== stringifyConfig(publicationState.published.config);
  const canPublishReady = !dirty && draftDiffersFromPublished && !loading && validation.valid;
  const { publish, publishing, rollback, rollingBackRevision, save, saving } =
    useMobilePublicationActions({
      asyncGuard,
      canPublish: canPublishReady,
      canSave: canSaveReady,
      formValues,
      publicationState,
      setBaseline,
      setError,
      setFormValues,
      setPublicationState,
      setSuccess,
      tr,
    });
  const canSave = canSaveReady && !saving;
  const canPublish = canPublishReady && !saving && !publishing;
  useUnsavedChangesGuard({
    cancelText: tr('admin.mobile.unsavedStay', 'Keep editing'),
    confirmText: tr('admin.mobile.unsavedLeave', 'Leave'),
    isDirty: dirty,
    message: tr(
      'admin.mobile.unsavedChanges',
      'You have unsaved mobile settings. Leave this page?',
    ),
    title: tr('admin.mobile.unsavedTitle', 'Discard unsaved mobile settings?'),
  });

  useEffect(() => {
    if (dirty) return;
    const refreshPublication = async () => {
      try {
        const publication = await adminCommercialService.getMobileSettingsPublication();
        if (!asyncGuard.isMounted()) return;
        const normalized = toFormConfig(publication.draft.config);
        setPublicationState(publication);
        setFormValues(normalized);
        setBaseline(normalized);
      } catch {
        // Keep the current editor state; the explicit page error path handles initial load failures.
      }
    };
    window.addEventListener('focus', refreshPublication);
    window.addEventListener('online', refreshPublication);
    return () => {
      window.removeEventListener('focus', refreshPublication);
      window.removeEventListener('online', refreshPublication);
    };
  }, [asyncGuard, dirty]);

  const updateForm = (next: MobilePublicConfigV1) => {
    asyncGuard.markDraftChanged();
    setSuccess(undefined);
    setError(undefined);
    setFormValues(next);
  };

  const restoreDefaults = () => {
    confirmModal({
      cancelText: tr('admin.mobile.restoreCancel', 'Cancel'),
      content: tr(
        'admin.mobile.restoreDescription',
        'Current draft values will be replaced by the mobile defaults.',
      ),
      okText: tr('admin.mobile.restoreDefaults', 'Restore defaults'),
      onOk: () => updateForm(cloneConfig(DEFAULT_MOBILE_CONFIG)),
      title: tr('admin.mobile.restoreConfirm', 'Restore mobile defaults?'),
    });
  };

  if (loading) {
    return (
      <AdminPageShell
        description={tr('admin.mobile.subtitle', '配置手机端品牌、导航、内容入口和发布版本。')}
        title={tr('admin.mobile.title', '手机端配置')}
        width="full"
      >
        <MobileSettingsLoading />
      </AdminPageShell>
    );
  }

  const sectionProps = { formValues, tr, updateForm };
  return (
    <AdminPageShell
      description={tr('admin.mobile.subtitle', '配置手机端品牌、导航、内容入口和发布版本。')}
      title={tr('admin.mobile.title', '手机端配置')}
      width="full"
    >
      <Flexbox gap={24}>
        <MobileSettingsFeedback
          error={error}
          loadPublication={loadPublication}
          success={success}
          validation={validation}
        />

        <BrandSection {...sectionProps} />
        <BottomNavigationSection {...sectionProps} />
        <DesignToolsSection {...sectionProps} />
        <DiscoverCommunitySection {...sectionProps} />
        <FeaturedAssistantsSection
          {...sectionProps}
          assistantOptions={assistantOptions}
          assistantStatus={assistantStatus}
          modelOptions={modelOptions}
          modelStatus={modelStatus}
          selectedAssistantId={selectedAssistantId}
          selectedModelValue={selectedModelValue}
          setSelectedAssistantId={setSelectedAssistantId}
          setSelectedModelValue={setSelectedModelValue}
          onLoadAssistants={() => void refreshAssistantOptions()}
          onLoadModels={() => void refreshModelOptions()}
          onRetryAssistants={() => void refreshAssistantOptions()}
          onRetryModels={() => void refreshModelOptions()}
        />
        <ApplicationsSection
          {...sectionProps}
          moduleAppOptions={moduleAppOptions}
          moduleAppStatus={moduleAppStatus}
          selectedModuleAppId={selectedModuleAppId}
          setSelectedModuleAppId={setSelectedModuleAppId}
          onLoadModuleApps={() => void refreshModuleAppOptions()}
          onRetryModuleApps={() => void refreshModuleAppOptions()}
        />

        <PreviewSection config={normalizedPreview} t={tr} />

        <PublicationHistorySection
          publicationState={publicationState}
          rollingBackRevision={rollingBackRevision}
          t={tr}
          onRollback={(revision) => void rollback(revision)}
        />

        <MobileSettingsActions
          canPublish={canPublish}
          canSave={canSave}
          publish={publish}
          publishing={publishing}
          restoreDefaults={restoreDefaults}
          save={save}
          saving={saving}
          tr={tr}
        />
      </Flexbox>
    </AdminPageShell>
  );
});

AdminMobileSettingsPage.displayName = 'AdminMobileSettingsPage';

export { createMobileSettingsAsyncGuard };
export default AdminMobileSettingsPage;
