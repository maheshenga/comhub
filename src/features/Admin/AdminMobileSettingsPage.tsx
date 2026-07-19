'use client';

import { Button, Flexbox, Skeleton } from '@lobehub/ui';
import { Switch } from '@lobehub/ui/base-ui';
import { Alert, Input } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  DEFAULT_MOBILE_CONFIG,
  MOBILE_ICON_NAMES,
  type MobileBuiltinAppV1,
  type MobileDesignToolV1,
  type MobileFeaturedAssistantV1,
  type MobileIconName,
  type MobileNavigationItemV1,
  type MobilePublicConfigV1,
  normalizeMobileConfig,
  validateMobileInternalPath,
} from '@/const/mobileConfig';
import { adminCommercialService } from '@/services/adminCommercial';
import { discoverService } from '@/services/discover';

import MobileConfigPreview from './MobileConfigPreview';

const styles = createStaticStyles(({ css }) => ({
  actionRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
  `,
  field: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 160px;
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
  select: css`
    height: 32px;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: 6px;
    background: ${cssVar.colorBgContainer};
    color: ${cssVar.colorText};
  `,
}));

type SelectOption = {
  label: string;
  value: string;
};

type ModelOption = SelectOption & {
  model: string;
  provider: string;
};

type ValidationResult = {
  messages: string[];
  valid: boolean;
};

type SelectorStatus = {
  error?: string;
  loading: boolean;
};

type SelectorAlertProps = {
  label: string;
  onRetry: () => void;
  retryLabel: string;
  status: SelectorStatus;
};

const cloneConfig = (config: unknown): MobilePublicConfigV1 => normalizeMobileConfig(config);

const toFormConfig = (config: unknown): MobilePublicConfigV1 => cloneConfig(config);

const stringifyConfig = (config: MobilePublicConfigV1) =>
  JSON.stringify(normalizeMobileConfig(config));

const sortByOrder = <T extends { order: number }>(items: T[]) =>
  [...items].sort((left, right) => left.order - right.order);

const withReindexedOrder = <T extends { order: number }>(items: T[]) =>
  items.map((item, index) => ({ ...item, order: index + 1 }));

const updateNavigationItem = (
  config: MobilePublicConfigV1,
  id: MobileNavigationItemV1['id'],
  patch: Partial<MobileNavigationItemV1>,
): MobilePublicConfigV1 => ({
  ...config,
  navigation: {
    items: sortByOrder(config.navigation.items).map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  },
});

const updateDesignTool = (
  config: MobilePublicConfigV1,
  id: MobileDesignToolV1['id'],
  patch: Partial<MobileDesignToolV1>,
): MobilePublicConfigV1 => ({
  ...config,
  design: {
    tools: sortByOrder(config.design.tools).map((tool) =>
      tool.id === id ? { ...tool, ...patch } : tool,
    ),
  },
});

const updateBuiltinApp = (
  config: MobilePublicConfigV1,
  id: string,
  patch: Partial<MobileBuiltinAppV1>,
): MobilePublicConfigV1 => ({
  ...config,
  applications: {
    ...config.applications,
    builtins: sortByOrder(config.applications.builtins).map((app) =>
      app.id === id ? { ...app, ...patch } : app,
    ),
  },
});

const moveNavigationItem = (
  config: MobilePublicConfigV1,
  id: MobileNavigationItemV1['id'],
  direction: -1 | 1,
) => {
  const items = sortByOrder(config.navigation.items);
  const index = items.findIndex((item) => item.id === id);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return config;

  const nextItems = [...items];
  [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];

  return { ...config, navigation: { items: withReindexedOrder(nextItems) } };
};

const validateFormConfig = (config: MobilePublicConfigV1): ValidationResult => {
  const visibleTabs = config.navigation.items.filter((item) => item.visible);
  const messages: string[] = [];

  if (visibleTabs.length < 2) messages.push('At least two bottom tabs must be visible.');

  const visiblePaths = visibleTabs.map((item) => item.path);
  const hasUnsafePath = visiblePaths.some((path) => !validateMobileInternalPath(path));
  const hasDuplicatePath = new Set(visiblePaths).size !== visiblePaths.length;
  if (hasUnsafePath || hasDuplicatePath)
    messages.push('Visible tab paths must be internal and unique.');

  if (config.applications.builtins.some((app) => !validateMobileInternalPath(app.path))) {
    messages.push('Built-in app paths must be internal.');
  }

  return { messages, valid: messages.length === 0 };
};

const loadAssistantOptions = async (): Promise<SelectOption[]> => {
  const query = {
    includeAgentGroup: false,
    pageSize: 100,
    source: 'new',
  } as const;
  const firstPage = await discoverService.getAssistantList({ ...query, page: 1 });
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
      discoverService.getAssistantList({ ...query, page: index + 2 }),
    ),
  );
  const seen = new Set<string>();

  return [firstPage, ...remainingPages]
    .flatMap((response) => response.items ?? [])
    .filter((assistant) => !assistant.status || assistant.status === 'published')
    .map((assistant): SelectOption | undefined => {
      if (!assistant.identifier || seen.has(assistant.identifier)) return;
      seen.add(assistant.identifier);
      return {
        label: assistant.title || assistant.identifier,
        value: assistant.identifier,
      };
    })
    .filter((option): option is SelectOption => Boolean(option));
};

const collectModelEntries = (value: unknown): any[] => {
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const direct =
    record.enabledModels ?? record.models ?? record.items ?? (record.catalog as any)?.models;
  if (Array.isArray(direct)) return direct;
  return [];
};

const loadModelOptions = async (): Promise<ModelOption[]> => {
  const diagnostics = await adminCommercialService.getAiProviderModelCatalogDiagnostics();
  const seen = new Set<string>();

  return collectModelEntries(diagnostics)
    .map((entry): ModelOption | undefined => {
      const provider = String(entry.provider ?? entry.providerId ?? entry.instanceId ?? '').trim();
      const model = String(entry.modelId ?? entry.id ?? entry.model ?? '').trim();
      if (!provider || !model) return;
      const value = `${provider}/${model}`;
      if (seen.has(value)) return;
      seen.add(value);

      return {
        label: String(entry.displayName ?? entry.name ?? model),
        model,
        provider,
        value,
      };
    })
    .filter((option): option is ModelOption => Boolean(option));
};

const loadModuleAppOptions = async (): Promise<SelectOption[]> => {
  const items: any[] = [];
  const seenCursors = new Set<string>();
  let cursor: number | string | undefined;

  while (true) {
    const response = await adminCommercialService.moduleApps.list({
      ...(cursor === undefined ? {} : { cursor }),
      limit: 200,
      status: 'published',
    });
    if (Array.isArray((response as any)?.items)) items.push(...(response as any).items);

    const nextCursor = (response as any)?.nextCursor as number | string | null | undefined;
    if (nextCursor === null || nextCursor === undefined) break;
    const cursorKey = String(nextCursor);
    if (seenCursors.has(cursorKey)) break;
    seenCursors.add(cursorKey);
    cursor = nextCursor;
  }

  const seenIds = new Set<string>();

  return items
    .map((app: any): SelectOption | undefined => {
      const value = String(app.appId ?? app.id ?? '').trim();
      if (!value || seenIds.has(value)) return;
      seenIds.add(value);
      return {
        label: String(app.displayName ?? app.name ?? app.title ?? value),
        value,
      };
    })
    .filter((option): option is SelectOption => Boolean(option));
};

export const createMobileSettingsAsyncGuard = () => {
  let draftRevision = 0;
  let mounted = false;
  let saveInFlight = false;

  return {
    beginSave: () => {
      if (!mounted || saveInFlight) return;
      saveInFlight = true;
      return draftRevision;
    },
    finishSave: () => {
      saveInFlight = false;
    },
    isCurrent: (submittedRevision: number) => mounted && draftRevision === submittedRevision,
    isMounted: () => mounted,
    markDraftChanged: () => {
      draftRevision += 1;
    },
    mount: () => {
      mounted = true;
    },
    unmount: () => {
      mounted = false;
    },
  };
};

const idleSelectorStatus: SelectorStatus = { loading: false };

const LabeledField = ({ children, label }: { children: ReactNode; label: string }) => (
  <label className={styles.field}>
    <span>{label}</span>
    {children}
  </label>
);

const IconSelect = ({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: MobileIconName) => void;
  value: string;
}) => (
  <select
    aria-label={label}
    className={styles.select}
    value={value}
    onChange={(event) => onChange(event.target.value)}
  >
    {MOBILE_ICON_NAMES.map((icon) => (
      <option key={icon} value={icon}>
        {icon}
      </option>
    ))}
  </select>
);

const SelectField = ({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  value: string;
}) => (
  <select
    aria-label={label}
    className={styles.select}
    disabled={disabled}
    value={value}
    onChange={(event) => onChange(event.target.value)}
  >
    <option value="">Select</option>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

const AccessibleSwitch = ({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) => {
  const id = useId();

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <Switch checked={checked} id={id} onChange={(nextChecked) => onChange(nextChecked)} />
    </div>
  );
};

const SelectorAlert = ({ label, onRetry, retryLabel, status }: SelectorAlertProps) =>
  status.error ? (
    <Alert
      showIcon
      title={label}
      type="warning"
      action={
        <Button disabled={status.loading} size="small" onClick={onRetry}>
          {retryLabel}
        </Button>
      }
    />
  ) : null;

const AdminMobileSettingsPage = memo(() => {
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
      setAssistantStatus({ error: 'Assistant selector unavailable.', loading: false });
    }
  }, [asyncGuard]);

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
      setModelStatus({ error: 'Model selector unavailable.', loading: false });
    }
  }, [asyncGuard]);

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
      setModuleAppStatus({ error: 'Module app selector unavailable.', loading: false });
    }
  }, [asyncGuard]);

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
        if (asyncGuard.isMounted()) setError('Failed to load mobile settings.');
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
  ]);

  const normalizedPreview = useMemo(() => normalizeMobileConfig(formValues), [formValues]);
  const validation = useMemo(() => validateFormConfig(formValues), [formValues]);
  const dirty = stringifyConfig(formValues) !== stringifyConfig(baseline);
  const canSave = dirty && !loading && !saving && validation.valid;
  const assistantSelectorUnavailable = Boolean(assistantStatus.error);
  const modelSelectorUnavailable = Boolean(modelStatus.error);
  const moduleAppSelectorUnavailable = Boolean(moduleAppStatus.error);
  const canAddFeaturedAssistant =
    !assistantSelectorUnavailable &&
    !modelSelectorUnavailable &&
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
    if (!window.confirm('Restore mobile defaults?')) return;
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
        setSuccess('Mobile settings saved.');
      }
    } catch {
      if (asyncGuard.isMounted()) setError('Failed to save mobile settings.');
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

      <section aria-label="Brand" className={styles.section}>
        <h2 className={styles.sectionTitle}>Brand</h2>
        <div className={styles.grid}>
          <LabeledField label="Brand display name">
            <Input
              aria-label="Brand display name"
              value={formValues.brand.displayName ?? ''}
              onChange={(event) =>
                updateForm({
                  ...formValues,
                  brand: { ...formValues.brand, displayName: event.target.value || null },
                })
              }
            />
          </LabeledField>
          <LabeledField label="Brand logo URL">
            <Input
              aria-label="Brand logo URL"
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

      <section aria-label="Bottom Navigation" className={styles.section}>
        <h2 className={styles.sectionTitle}>Bottom Navigation</h2>
        {sortByOrder(formValues.navigation.items).map((item) => (
          <div className={styles.itemRow} key={item.id}>
            <LabeledField label={`Tab ${item.id} label`}>
              <Input
                aria-label={`Tab ${item.id} label`}
                value={item.label}
                onChange={(event) =>
                  updateForm(
                    updateNavigationItem(formValues, item.id, { label: event.target.value }),
                  )
                }
              />
            </LabeledField>
            <LabeledField label={`Tab ${item.id} path`}>
              <Input
                aria-label={`Tab ${item.id} path`}
                value={item.path}
                onChange={(event) =>
                  updateForm(
                    updateNavigationItem(formValues, item.id, { path: event.target.value }),
                  )
                }
              />
            </LabeledField>
            <LabeledField label={`Tab ${item.id} icon`}>
              <IconSelect
                label={`Tab ${item.id} icon`}
                value={item.icon}
                onChange={(icon) => updateForm(updateNavigationItem(formValues, item.id, { icon }))}
              />
            </LabeledField>
            <AccessibleSwitch
              checked={item.visible}
              label={`Tab ${item.id} visible`}
              onChange={(visible) =>
                updateForm(updateNavigationItem(formValues, item.id, { visible }))
              }
            />
            <Flexbox horizontal gap={4}>
              <Button
                aria-label={`Move ${item.id} up`}
                disabled={item.order === 1}
                icon={<ArrowUp size={14} />}
                onClick={() => updateForm(moveNavigationItem(formValues, item.id, -1))}
              />
              <Button
                aria-label={`Move ${item.id} down`}
                disabled={item.order === formValues.navigation.items.length}
                icon={<ArrowDown size={14} />}
                onClick={() => updateForm(moveNavigationItem(formValues, item.id, 1))}
              />
            </Flexbox>
          </div>
        ))}
      </section>

      <section aria-label="Design Tools" className={styles.section}>
        <h2 className={styles.sectionTitle}>Design Tools</h2>
        {sortByOrder(formValues.design.tools).map((tool) => (
          <div className={styles.itemRow} key={tool.id}>
            <LabeledField label={`Tool ${tool.id} label`}>
              <Input
                aria-label={`Tool ${tool.id} label`}
                value={tool.label}
                onChange={(event) =>
                  updateForm(updateDesignTool(formValues, tool.id, { label: event.target.value }))
                }
              />
            </LabeledField>
            <LabeledField label={`Tool ${tool.id} icon`}>
              <IconSelect
                label={`Tool ${tool.id} icon`}
                value={tool.icon}
                onChange={(icon) => updateForm(updateDesignTool(formValues, tool.id, { icon }))}
              />
            </LabeledField>
            <span />
            <AccessibleSwitch
              checked={tool.enabled}
              label={`Tool ${tool.id} enabled`}
              onChange={(enabled) => updateForm(updateDesignTool(formValues, tool.id, { enabled }))}
            />
            <span />
          </div>
        ))}
      </section>

      <section aria-label="Featured Assistants" className={styles.section}>
        <h2 className={styles.sectionTitle}>Featured Assistants</h2>
        <SelectorAlert
          label="Assistant selector unavailable."
          retryLabel="Retry assistant selector"
          status={assistantStatus}
          onRetry={() => void refreshAssistantOptions()}
        />
        <SelectorAlert
          label="Model selector unavailable."
          retryLabel="Retry model selector"
          status={modelStatus}
          onRetry={() => void refreshModelOptions()}
        />
        <div className={styles.grid}>
          <SelectField
            disabled={assistantStatus.loading || assistantSelectorUnavailable}
            label="Featured assistant"
            options={assistantOptions}
            value={selectedAssistantId}
            onChange={setSelectedAssistantId}
          />
          <SelectField
            disabled={modelStatus.loading || modelSelectorUnavailable}
            label="Recommended model"
            options={modelOptions}
            value={selectedModelValue}
            onChange={setSelectedModelValue}
          />
          <Button disabled={!canAddFeaturedAssistant} onClick={addFeaturedAssistant}>
            Add featured assistant
          </Button>
        </div>
        <Flexbox gap={8}>
          {sortByOrder(formValues.discover.assistants).map((assistant) => (
            <span key={assistant.assistantId}>
              {assistant.titleOverride ?? assistant.assistantId}
            </span>
          ))}
        </Flexbox>
      </section>

      <section aria-label="App Entries" className={styles.section}>
        <h2 className={styles.sectionTitle}>App Entries</h2>
        <SelectorAlert
          label="Module app selector unavailable."
          retryLabel="Retry module app selector"
          status={moduleAppStatus}
          onRetry={() => void refreshModuleAppOptions()}
        />
        <div className={styles.grid}>
          <SelectField
            disabled={moduleAppStatus.loading || moduleAppSelectorUnavailable}
            label="Featured module app"
            options={moduleAppOptions}
            value={selectedModuleAppId}
            onChange={setSelectedModuleAppId}
          />
          <Button disabled={!canAddModuleApp} onClick={addModuleApp}>
            Add module app
          </Button>
        </div>
        <Flexbox gap={8}>
          {formValues.applications.featuredModuleAppIds.map((id) => (
            <span key={id}>
              {moduleAppOptions.find((option) => option.value === id)?.label ?? id}
            </span>
          ))}
        </Flexbox>
        {sortByOrder(formValues.applications.builtins).map((app) => (
          <div className={styles.itemRow} key={app.id}>
            <LabeledField label={`Builtin ${app.id} label`}>
              <Input
                aria-label={`Builtin ${app.id} label`}
                value={app.label}
                onChange={(event) =>
                  updateForm(updateBuiltinApp(formValues, app.id, { label: event.target.value }))
                }
              />
            </LabeledField>
            <LabeledField label={`Builtin ${app.id} path`}>
              <Input
                aria-label={`Builtin ${app.id} path`}
                value={app.path}
                onChange={(event) =>
                  updateForm(updateBuiltinApp(formValues, app.id, { path: event.target.value }))
                }
              />
            </LabeledField>
            <LabeledField label={`Builtin ${app.id} icon`}>
              <IconSelect
                label={`Builtin ${app.id} icon`}
                value={app.icon}
                onChange={(icon) => updateForm(updateBuiltinApp(formValues, app.id, { icon }))}
              />
            </LabeledField>
            <AccessibleSwitch
              checked={app.enabled}
              label={`Builtin ${app.id} enabled`}
              onChange={(enabled) => updateForm(updateBuiltinApp(formValues, app.id, { enabled }))}
            />
            <span />
          </div>
        ))}
      </section>

      <section aria-label="Preview" className={styles.section}>
        <h2 className={styles.sectionTitle}>Preview</h2>
        <MobileConfigPreview config={normalizedPreview} />
      </section>

      <div className={styles.actionRow}>
        <Button onClick={restoreDefaults}>Restore defaults</Button>
        <Button disabled={!canSave} loading={saving} type="primary" onClick={() => void save()}>
          Save mobile settings
        </Button>
      </div>
    </Flexbox>
  );
});

AdminMobileSettingsPage.displayName = 'AdminMobileSettingsPage';

export default AdminMobileSettingsPage;
