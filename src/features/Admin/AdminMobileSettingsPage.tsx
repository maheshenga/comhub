'use client';

import { Button, Flexbox, Skeleton } from '@lobehub/ui';
import { Alert, Input } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DEFAULT_MOBILE_CONFIG,
  type MobileFeaturedAssistantV1,
  type MobilePublicConfigV1,
  normalizeMobileConfig,
} from '@/const/mobileConfig';
import { adminCommercialService } from '@/services/adminCommercial';

import MobileConfigPreview from './MobileConfigPreview';
import {
  AccessibleSwitch,
  IconSelect,
  LabeledField,
  OrderButtons,
  RemoveButton,
  SelectField,
  SelectorAlert,
} from './MobileSettingsControls';
import {
  cloneConfig,
  createMobileSettingsAsyncGuard,
  idleSelectorStatus,
  loadAssistantOptions,
  loadModelOptions,
  loadModuleAppOptions,
  type ModelOption,
  moveArrayItem,
  moveNavigationItem,
  moveOrderedItem,
  removeOrderedItem,
  type SelectOption,
  type SelectorStatus,
  sortByOrder,
  stringifyConfig,
  toFormConfig,
  updateBuiltinApp,
  updateDesignTool,
  updateNavigationItem,
  validateFormConfig,
} from './mobileSettingsHelpers';

const styles = createStaticStyles(({ css }) => ({
  actionRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  `,
  itemRow: css`
    display: grid;
    grid-template-columns: minmax(130px, 1fr) minmax(130px, 1fr) minmax(140px, 1fr) auto auto;
    gap: 8px;
    align-items: end;
    padding-block: 10px;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};

    @media (max-width: 900px) {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    @media (max-width: 560px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  orderedEntry: css`
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    min-height: 40px;
    padding-block: 8px;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
  `,
  page: css`
    width: min(100%, 1120px);
    padding: 24px;

    @media (max-width: 640px) {
      padding: 16px;
    }
  `,
  section: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  sectionTitle: css`
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  `,
}));

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
  const [assistantOptions, setAssistantOptions] = useState<SelectOption[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [moduleAppOptions, setModuleAppOptions] = useState<SelectOption[]>([]);
  const [assistantStatus, setAssistantStatus] = useState<SelectorStatus>(idleSelectorStatus);
  const [modelStatus, setModelStatus] = useState<SelectorStatus>(idleSelectorStatus);
  const [moduleAppStatus, setModuleAppStatus] = useState<SelectorStatus>(idleSelectorStatus);
  const [selectedAssistantId, setSelectedAssistantId] = useState('');
  const [selectedModelValue, setSelectedModelValue] = useState('');
  const [selectedModuleAppId, setSelectedModuleAppId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const commitFormValues = useCallback((next: MobilePublicConfigV1) => {
    setFormValues(next);
  }, []);

  const refreshAssistantOptions = useCallback(async () => {
    if (!asyncGuard.isMounted()) return;
    setAssistantStatus({ loading: true });
    try {
      const assistants = await loadAssistantOptions();
      if (!asyncGuard.isMounted()) return;
      setAssistantOptions(assistants);
      setAssistantStatus({ loading: false });
    } catch {
      if (!asyncGuard.isMounted()) return;
      setAssistantOptions([]);
      setSelectedAssistantId('');
      setAssistantStatus({
        error: tr('admin.mobile.assistantSelectorUnavailable', 'Assistant selector unavailable.'),
        loading: false,
      });
    }
  }, [asyncGuard, tr]);

  const refreshModelOptions = useCallback(async () => {
    if (!asyncGuard.isMounted()) return;
    setModelStatus({ loading: true });
    try {
      const models = await loadModelOptions();
      if (!asyncGuard.isMounted()) return;
      setModelOptions(models);
      setModelStatus({ loading: false });
    } catch {
      if (!asyncGuard.isMounted()) return;
      setModelOptions([]);
      setSelectedModelValue('');
      setModelStatus({
        error: tr('admin.mobile.modelSelectorUnavailable', 'Model selector unavailable.'),
        loading: false,
      });
    }
  }, [asyncGuard, tr]);

  const refreshModuleAppOptions = useCallback(async () => {
    if (!asyncGuard.isMounted()) return;
    setModuleAppStatus({ loading: true });
    try {
      const moduleApps = await loadModuleAppOptions();
      if (!asyncGuard.isMounted()) return;
      setModuleAppOptions(moduleApps);
      setModuleAppStatus({ loading: false });
    } catch {
      if (!asyncGuard.isMounted()) return;
      setModuleAppOptions([]);
      setSelectedModuleAppId('');
      setModuleAppStatus({
        error: tr('admin.mobile.moduleAppSelectorUnavailable', 'Module app selector unavailable.'),
        loading: false,
      });
    }
  }, [asyncGuard, tr]);

  useEffect(() => {
    asyncGuard.mount();

    const load = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const settings = await adminCommercialService.getMobileSettings();
        if (!asyncGuard.isMounted()) return;
        const normalized = toFormConfig(settings);
        commitFormValues(normalized);
        setBaseline(normalized);
      } catch {
        if (asyncGuard.isMounted()) {
          setError(tr('admin.mobile.loadError', 'Failed to load mobile settings.'));
        }
      } finally {
        if (asyncGuard.isMounted()) setLoading(false);
      }
    };

    void load();
    void refreshAssistantOptions();
    void refreshModelOptions();
    void refreshModuleAppOptions();

    return () => {
      asyncGuard.unmount();
    };
  }, [
    asyncGuard,
    commitFormValues,
    refreshAssistantOptions,
    refreshModelOptions,
    refreshModuleAppOptions,
    tr,
  ]);

  const normalizedPreview = useMemo(() => normalizeMobileConfig(formValues), [formValues]);
  const validation = useMemo(
    () =>
      validateFormConfig(formValues, {
        builtinPaths: tr(
          'admin.mobile.validation.builtinPaths',
          'Built-in app paths must be internal.',
        ),
        minVisibleTabs: tr(
          'admin.mobile.validation.minVisibleTabs',
          'At least two bottom tabs must be visible.',
        ),
        uniquePaths: tr(
          'admin.mobile.validation.uniquePaths',
          'Visible tab paths must be internal and unique.',
        ),
      }),
    [formValues, tr],
  );
  const dirty = stringifyConfig(formValues) !== stringifyConfig(baseline);
  const canSave = dirty && !loading && !saving && validation.valid;
  const assistantSelectorUnavailable = Boolean(assistantStatus.error);
  const modelSelectorUnavailable = Boolean(modelStatus.error);
  const moduleAppSelectorUnavailable = Boolean(moduleAppStatus.error);
  const canAddFeaturedAssistant =
    !assistantSelectorUnavailable &&
    !modelSelectorUnavailable &&
    formValues.discover.assistants.length < 4 &&
    Boolean(selectedAssistantId) &&
    Boolean(selectedModelValue);
  const canAddModuleApp = !moduleAppSelectorUnavailable && Boolean(selectedModuleAppId);

  const updateForm = (next: MobilePublicConfigV1) => {
    asyncGuard.markDraftChanged();
    setSuccess(undefined);
    setError(undefined);
    commitFormValues(next);
  };

  const addFeaturedAssistant = () => {
    if (!canAddFeaturedAssistant) return;
    const assistant = assistantOptions.find((option) => option.value === selectedAssistantId);
    const model = modelOptions.find((option) => option.value === selectedModelValue);
    if (!assistant || !model) return;
    if (formValues.discover.assistants.some((item) => item.assistantId === assistant.value)) return;

    const nextAssistant: MobileFeaturedAssistantV1 = {
      assistantId: assistant.value,
      model: model.model,
      order: formValues.discover.assistants.length + 1,
      provider: model.provider,
      titleOverride: assistant.label,
    };

    updateForm({
      ...formValues,
      discover: {
        ...formValues.discover,
        assistants: [...formValues.discover.assistants, nextAssistant],
      },
    });
  };

  const addModuleApp = () => {
    if (!canAddModuleApp) return;
    if (formValues.applications.featuredModuleAppIds.includes(selectedModuleAppId)) return;

    updateForm({
      ...formValues,
      applications: {
        ...formValues.applications,
        featuredModuleAppIds: [
          ...formValues.applications.featuredModuleAppIds,
          selectedModuleAppId,
        ],
      },
    });
  };

  const restoreDefaults = () => {
    if (!window.confirm(tr('admin.mobile.restoreConfirm', 'Restore mobile defaults?'))) return;
    updateForm(cloneConfig(DEFAULT_MOBILE_CONFIG));
  };

  const save = async () => {
    if (!canSave) return;
    const submittedRevision = asyncGuard.beginSave();
    if (submittedRevision === undefined) return;
    const submittedConfig = normalizeMobileConfig(formValues);
    setSaving(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const saved = await adminCommercialService.saveMobileSettings(submittedConfig);
      if (!asyncGuard.isMounted()) return;
      const normalized = cloneConfig(saved);
      setBaseline(normalized);
      if (asyncGuard.isCurrent(submittedRevision)) {
        commitFormValues(normalized);
        setSuccess(tr('admin.mobile.saved', 'Mobile settings saved.'));
      }
    } catch {
      if (asyncGuard.isMounted()) {
        setError(tr('admin.mobile.saveError', 'Failed to save mobile settings.'));
      }
    } finally {
      asyncGuard.finishSave();
      if (asyncGuard.isMounted()) setSaving(false);
    }
  };

  if (loading) {
    return (
      <Flexbox className={styles.page} data-testid="mobile-settings-loading" gap={16}>
        <Skeleton.Button active block style={{ height: 32, width: 240 }} />
        <Skeleton.Paragraph active rows={4} />
        <Skeleton.Button active block style={{ height: 120 }} />
      </Flexbox>
    );
  }

  return (
    <Flexbox className={styles.page} gap={24}>
      {error ? <Alert showIcon title={error} type="error" /> : null}
      {success ? <Alert showIcon title={success} type="success" /> : null}
      {validation.messages.map((message) => (
        <Alert showIcon key={message} title={message} type="warning" />
      ))}

      <section aria-label={tr('admin.mobile.brand', 'Brand')} className={styles.section}>
        <h2 className={styles.sectionTitle}>{tr('admin.mobile.brand', 'Brand')}</h2>
        <div className={styles.grid}>
          <LabeledField label={tr('admin.mobile.brandDisplayName', 'Brand display name')}>
            <Input
              aria-label={tr('admin.mobile.brandDisplayName', 'Brand display name')}
              value={formValues.brand.displayName ?? ''}
              onChange={(event) =>
                updateForm({
                  ...formValues,
                  brand: { ...formValues.brand, displayName: event.target.value || null },
                })
              }
            />
          </LabeledField>
          <LabeledField label={tr('admin.mobile.brandLogoUrl', 'Brand logo URL')}>
            <Input
              aria-label={tr('admin.mobile.brandLogoUrl', 'Brand logo URL')}
              value={formValues.brand.logoUrl ?? ''}
              onChange={(event) =>
                updateForm({
                  ...formValues,
                  brand: { ...formValues.brand, logoUrl: event.target.value || null },
                })
              }
            />
          </LabeledField>
        </div>
      </section>

      <section
        aria-label={tr('admin.mobile.bottomNavigation', 'Bottom Navigation')}
        className={styles.section}
      >
        <h2 className={styles.sectionTitle}>
          {tr('admin.mobile.bottomNavigation', 'Bottom Navigation')}
        </h2>
        {sortByOrder(formValues.navigation.items).map((item, index, items) => (
          <div className={styles.itemRow} key={item.id}>
            <LabeledField label={tr('admin.mobile.tabLabel', 'Tab {{id}} label', { id: item.id })}>
              <Input
                aria-label={tr('admin.mobile.tabLabel', 'Tab {{id}} label', { id: item.id })}
                value={item.label}
                onChange={(event) =>
                  updateForm(
                    updateNavigationItem(formValues, item.id, { label: event.target.value }),
                  )
                }
              />
            </LabeledField>
            <LabeledField label={tr('admin.mobile.tabPath', 'Tab {{id}} path', { id: item.id })}>
              <Input
                aria-label={tr('admin.mobile.tabPath', 'Tab {{id}} path', { id: item.id })}
                value={item.path}
                onChange={(event) =>
                  updateForm(
                    updateNavigationItem(formValues, item.id, { path: event.target.value }),
                  )
                }
              />
            </LabeledField>
            <LabeledField label={tr('admin.mobile.tabIcon', 'Tab {{id}} icon', { id: item.id })}>
              <IconSelect
                label={tr('admin.mobile.tabIcon', 'Tab {{id}} icon', { id: item.id })}
                value={item.icon}
                onChange={(icon) => updateForm(updateNavigationItem(formValues, item.id, { icon }))}
              />
            </LabeledField>
            <AccessibleSwitch
              checked={item.visible}
              label={tr('admin.mobile.tabVisible', 'Tab {{id}} visible', { id: item.id })}
              onChange={(visible) =>
                updateForm(updateNavigationItem(formValues, item.id, { visible }))
              }
            />
            <OrderButtons
              label={item.id}
              position={index}
              total={items.length}
              onMove={(direction) => updateForm(moveNavigationItem(formValues, item.id, direction))}
            />
          </div>
        ))}
      </section>

      <section
        aria-label={tr('admin.mobile.designTools', 'Design Tools')}
        className={styles.section}
      >
        <h2 className={styles.sectionTitle}>{tr('admin.mobile.designTools', 'Design Tools')}</h2>
        {sortByOrder(formValues.design.tools).map((tool, index, tools) => (
          <div className={styles.itemRow} key={tool.id}>
            <LabeledField
              label={tr('admin.mobile.toolLabel', 'Tool {{id}} label', { id: tool.id })}
            >
              <Input
                aria-label={tr('admin.mobile.toolLabel', 'Tool {{id}} label', { id: tool.id })}
                value={tool.label}
                onChange={(event) =>
                  updateForm(updateDesignTool(formValues, tool.id, { label: event.target.value }))
                }
              />
            </LabeledField>
            <LabeledField label={tr('admin.mobile.toolIcon', 'Tool {{id}} icon', { id: tool.id })}>
              <IconSelect
                label={tr('admin.mobile.toolIcon', 'Tool {{id}} icon', { id: tool.id })}
                value={tool.icon}
                onChange={(icon) => updateForm(updateDesignTool(formValues, tool.id, { icon }))}
              />
            </LabeledField>
            <OrderButtons
              label={tr('admin.mobile.target.tool', 'tool {{id}}', { id: tool.id })}
              position={index}
              total={tools.length}
              onMove={(direction) =>
                updateForm({
                  ...formValues,
                  design: {
                    tools: moveOrderedItem(
                      formValues.design.tools,
                      (item) => item.id === tool.id,
                      direction,
                    ),
                  },
                })
              }
            />
            <AccessibleSwitch
              checked={tool.enabled}
              label={tr('admin.mobile.toolEnabled', 'Tool {{id}} enabled', { id: tool.id })}
              onChange={(enabled) => updateForm(updateDesignTool(formValues, tool.id, { enabled }))}
            />
            <span />
          </div>
        ))}
      </section>

      <section
        aria-label={tr('admin.mobile.featuredAssistants', 'Featured Assistants')}
        className={styles.section}
      >
        <h2 className={styles.sectionTitle}>
          {tr('admin.mobile.featuredAssistants', 'Featured Assistants')}
        </h2>
        <SelectorAlert
          label={tr('admin.mobile.assistantSelectorUnavailable', 'Assistant selector unavailable.')}
          retryLabel={tr('admin.mobile.retryAssistantSelector', 'Retry assistant selector')}
          status={assistantStatus}
          onRetry={() => void refreshAssistantOptions()}
        />
        <SelectorAlert
          label={tr('admin.mobile.modelSelectorUnavailable', 'Model selector unavailable.')}
          retryLabel={tr('admin.mobile.retryModelSelector', 'Retry model selector')}
          status={modelStatus}
          onRetry={() => void refreshModelOptions()}
        />
        <div className={styles.grid}>
          <SelectField
            disabled={assistantStatus.loading || assistantSelectorUnavailable}
            label={tr('admin.mobile.featuredAssistant', 'Featured assistant')}
            options={assistantOptions}
            value={selectedAssistantId}
            onChange={setSelectedAssistantId}
          />
          <SelectField
            disabled={modelStatus.loading || modelSelectorUnavailable}
            label={tr('admin.mobile.recommendedModel', 'Recommended model')}
            options={modelOptions}
            value={selectedModelValue}
            onChange={setSelectedModelValue}
          />
          <Button disabled={!canAddFeaturedAssistant} onClick={addFeaturedAssistant}>
            {tr('admin.mobile.addFeaturedAssistant', 'Add featured assistant')}
          </Button>
        </div>
        <Flexbox gap={8}>
          {sortByOrder(formValues.discover.assistants).map((assistant, index, assistants) => (
            <div className={styles.orderedEntry} key={assistant.assistantId}>
              <span>
                {assistant.titleOverride ?? assistant.assistantId} ({assistant.provider}/
                {assistant.model})
              </span>
              <Flexbox horizontal gap={4}>
                <OrderButtons
                  position={index}
                  total={assistants.length}
                  label={tr('admin.mobile.target.assistant', 'assistant {{id}}', {
                    id: assistant.assistantId,
                  })}
                  onMove={(direction) =>
                    updateForm({
                      ...formValues,
                      discover: {
                        ...formValues.discover,
                        assistants: moveOrderedItem(
                          formValues.discover.assistants,
                          (item) => item.assistantId === assistant.assistantId,
                          direction,
                        ),
                      },
                    })
                  }
                />
                <RemoveButton
                  label={tr('admin.mobile.target.assistant', 'assistant {{id}}', {
                    id: assistant.assistantId,
                  })}
                  onClick={() =>
                    updateForm({
                      ...formValues,
                      discover: {
                        ...formValues.discover,
                        assistants: removeOrderedItem(
                          formValues.discover.assistants,
                          (item) => item.assistantId === assistant.assistantId,
                        ),
                      },
                    })
                  }
                />
              </Flexbox>
            </div>
          ))}
        </Flexbox>
      </section>

      <section aria-label={tr('admin.mobile.appEntries', 'App Entries')} className={styles.section}>
        <h2 className={styles.sectionTitle}>{tr('admin.mobile.appEntries', 'App Entries')}</h2>
        <SelectorAlert
          retryLabel={tr('admin.mobile.retryModuleAppSelector', 'Retry module app selector')}
          status={moduleAppStatus}
          label={tr(
            'admin.mobile.moduleAppSelectorUnavailable',
            'Module app selector unavailable.',
          )}
          onRetry={() => void refreshModuleAppOptions()}
        />
        <div className={styles.grid}>
          <SelectField
            disabled={moduleAppStatus.loading || moduleAppSelectorUnavailable}
            label={tr('admin.mobile.featuredModuleApp', 'Featured module app')}
            options={moduleAppOptions}
            value={selectedModuleAppId}
            onChange={setSelectedModuleAppId}
          />
          <Button disabled={!canAddModuleApp} onClick={addModuleApp}>
            {tr('admin.mobile.addModuleApp', 'Add module app')}
          </Button>
        </div>
        <Flexbox gap={8}>
          {formValues.applications.featuredModuleAppIds.map((id, index, ids) => (
            <div className={styles.orderedEntry} key={id}>
              <span>{moduleAppOptions.find((option) => option.value === id)?.label ?? id}</span>
              <Flexbox horizontal gap={4}>
                <OrderButtons
                  label={tr('admin.mobile.target.moduleApp', 'module app {{id}}', { id })}
                  position={index}
                  total={ids.length}
                  onMove={(direction) =>
                    updateForm({
                      ...formValues,
                      applications: {
                        ...formValues.applications,
                        featuredModuleAppIds: moveArrayItem(
                          formValues.applications.featuredModuleAppIds,
                          id,
                          direction,
                        ),
                      },
                    })
                  }
                />
                <RemoveButton
                  label={tr('admin.mobile.target.moduleApp', 'module app {{id}}', { id })}
                  onClick={() =>
                    updateForm({
                      ...formValues,
                      applications: {
                        ...formValues.applications,
                        featuredModuleAppIds: formValues.applications.featuredModuleAppIds.filter(
                          (appId) => appId !== id,
                        ),
                      },
                    })
                  }
                />
              </Flexbox>
            </div>
          ))}
        </Flexbox>
        {sortByOrder(formValues.applications.builtins).map((app, index, apps) => (
          <div className={styles.itemRow} key={app.id}>
            <LabeledField
              label={tr('admin.mobile.builtinLabel', 'Builtin {{id}} label', { id: app.id })}
            >
              <Input
                value={app.label}
                aria-label={tr('admin.mobile.builtinLabel', 'Builtin {{id}} label', {
                  id: app.id,
                })}
                onChange={(event) =>
                  updateForm(updateBuiltinApp(formValues, app.id, { label: event.target.value }))
                }
              />
            </LabeledField>
            <LabeledField
              label={tr('admin.mobile.builtinPath', 'Builtin {{id}} path', { id: app.id })}
            >
              <Input
                value={app.path}
                aria-label={tr('admin.mobile.builtinPath', 'Builtin {{id}} path', {
                  id: app.id,
                })}
                onChange={(event) =>
                  updateForm(updateBuiltinApp(formValues, app.id, { path: event.target.value }))
                }
              />
            </LabeledField>
            <LabeledField
              label={tr('admin.mobile.builtinIcon', 'Builtin {{id}} icon', { id: app.id })}
            >
              <IconSelect
                label={tr('admin.mobile.builtinIcon', 'Builtin {{id}} icon', { id: app.id })}
                value={app.icon}
                onChange={(icon) => updateForm(updateBuiltinApp(formValues, app.id, { icon }))}
              />
            </LabeledField>
            <AccessibleSwitch
              checked={app.enabled}
              label={tr('admin.mobile.builtinEnabled', 'Builtin {{id}} enabled', { id: app.id })}
              onChange={(enabled) => updateForm(updateBuiltinApp(formValues, app.id, { enabled }))}
            />
            <OrderButtons
              label={tr('admin.mobile.target.builtin', 'builtin {{id}}', { id: app.id })}
              position={index}
              total={apps.length}
              onMove={(direction) =>
                updateForm({
                  ...formValues,
                  applications: {
                    ...formValues.applications,
                    builtins: moveOrderedItem(
                      formValues.applications.builtins,
                      (item) => item.id === app.id,
                      direction,
                    ),
                  },
                })
              }
            />
          </div>
        ))}
      </section>

      <section aria-label={tr('admin.mobile.preview', 'Preview')} className={styles.section}>
        <h2 className={styles.sectionTitle}>{tr('admin.mobile.preview', 'Preview')}</h2>
        <MobileConfigPreview config={normalizedPreview} />
      </section>

      <div className={styles.actionRow}>
        <Button onClick={restoreDefaults}>
          {tr('admin.mobile.restoreDefaults', 'Restore defaults')}
        </Button>
        <Button disabled={!canSave} loading={saving} type="primary" onClick={() => void save()}>
          {tr('admin.mobile.save', 'Save mobile settings')}
        </Button>
      </div>
    </Flexbox>
  );
});

AdminMobileSettingsPage.displayName = 'AdminMobileSettingsPage';

export { createMobileSettingsAsyncGuard };
export default AdminMobileSettingsPage;
