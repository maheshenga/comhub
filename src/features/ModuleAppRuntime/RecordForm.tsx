import type { ModuleAppInputSchema, ModuleAppScopeType } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Input, InputNumber, Select, Switch, TextArea } from '@lobehub/ui/base-ui';
import { Form, useForm } from '@lobehub/ui/base-ui/form';
import { createStaticStyles } from 'antd-style';
import { RefreshCw, Save } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR, { useSWRConfig } from 'swr';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { moduleAppService } from '@/services/moduleApp';

import { isModuleAppRecordListKey, type ModuleAppRecordData } from './recordRuntime';

const styles = createStaticStyles(({ css, cssVar }) => ({
  form: css`
    width: min(720px, 100%);
  `,
  root: css`
    width: 100%;
    min-width: 0;
    padding: 24px;
    background: ${cssVar.colorBgLayout};
  `,
}));

type ModuleAppInputField = ModuleAppInputSchema['fields'][number];

interface RecordFormProps {
  appId: string;
  collectionKey: string;
  fields: ModuleAppInputField[];
  onSaved?: (record: unknown) => void;
  recordId?: string;
  scopeType: ModuleAppScopeType;
  titleFieldKey?: string;
  workspaceId?: string;
}

const getValidationPattern = (value?: string) => {
  if (!value) return undefined;
  try {
    return new RegExp(value);
  } catch {
    return undefined;
  }
};

const getInitialValues = (fields: ModuleAppInputField[], data?: Record<string, unknown>) =>
  Object.fromEntries(fields.map((field) => [field.key, data?.[field.key] ?? field.defaultValue]));

const RecordForm = memo<RecordFormProps>(
  ({ appId, collectionKey, fields, onSaved, recordId, scopeType, titleFieldKey, workspaceId }) => {
    const { t } = useTranslation('common');
    const { mutate } = useSWRConfig();
    const submitRef = useRef<(values: Record<string, unknown>) => Promise<void>>(
      async () => undefined,
    );
    const form = useForm<Record<string, unknown>>({
      onSubmit: (values) => submitRef.current(values),
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState(false);
    const record = useSWR<ModuleAppRecordData | null>(
      recordId ? ['moduleApp.getRecord', appId, recordId, workspaceId ?? null] : null,
      () =>
        moduleAppService.getRecord({
          appId,
          recordId: recordId!,
          workspaceId,
        }) as Promise<ModuleAppRecordData | null>,
    );
    const resolvedTitleFieldKey = useMemo(
      () => titleFieldKey ?? fields.find((field) => field.type === 'text')?.key,
      [fields, titleFieldKey],
    );

    useEffect(() => {
      if (recordId && !record.data) return;
      form.setValues(getInitialValues(fields, record.data?.data));
    }, [fields, form, record.data, recordId]);

    if (record.isLoading) {
      return (
        <Flexbox align="center" className={styles.root} justify="center" padding={48}>
          <NeuralNetworkLoading size={36} />
        </Flexbox>
      );
    }

    if (record.error || (recordId && !record.data)) {
      return (
        <Flexbox className={styles.root} gap={12}>
          <Alert showIcon message={t('moduleApps.runtime.records.loadError')} type="error" />
          <Button icon={<RefreshCw size={16} />} onClick={() => void record.mutate()}>
            {t('moduleApps.runtime.retry')}
          </Button>
        </Flexbox>
      );
    }

    const submit = async (values: Record<string, unknown>) => {
      setSaving(true);
      setSaved(false);
      setSaveError(false);
      try {
        const titleValue = resolvedTitleFieldKey ? values[resolvedTitleFieldKey] : undefined;
        const payload = {
          appId,
          collectionKey,
          data: values,
          scopeType,
          ...(typeof titleValue === 'string' && titleValue.trim()
            ? { title: titleValue.trim() }
            : {}),
          workspaceId,
        };
        const result = recordId
          ? await moduleAppService.updateRecord({ ...payload, recordId })
          : await moduleAppService.createRecord(payload);

        await mutate((key) =>
          isModuleAppRecordListKey(key, { appId, collectionKey, scopeType, workspaceId }),
        );
        setSaved(true);
        onSaved?.(result);
      } catch {
        setSaveError(true);
      } finally {
        setSaving(false);
      }
    };

    submitRef.current = submit;

    return (
      <Flexbox className={styles.root} data-testid="module-app-record-form" gap={16}>
        {saved && <Alert showIcon message={t('moduleApps.runtime.records.saved')} type="success" />}
        {saveError && (
          <Alert showIcon message={t('moduleApps.runtime.records.saveError')} type="error" />
        )}
        <Form className={styles.form} form={form} layout="vertical">
          {fields.map((field) => {
            const validationPattern = getValidationPattern(field.validationPattern);
            const commonProps = {
              extra: field.helpText,
              label: field.label,
              name: field.key,
              required: field.required ? t('moduleApps.runtime.records.required') : false,
              validate: validationPattern
                ? (value: unknown) => {
                    if (value === undefined || value === null || value === '') return undefined;

                    return validationPattern.test(String(value))
                      ? undefined
                      : t('moduleApps.runtime.records.invalid');
                  }
                : undefined,
            };

            if (field.type === 'textarea') {
              return (
                <Form.Field key={field.key} {...commonProps}>
                  <TextArea autoSize={{ minRows: 4, maxRows: 12 }} />
                </Form.Field>
              );
            }
            if (field.type === 'number') {
              return (
                <Form.Field key={field.key} {...commonProps}>
                  <InputNumber style={{ width: '100%' }} />
                </Form.Field>
              );
            }
            if (field.type === 'boolean') {
              return (
                <Form.Field key={field.key} {...commonProps} valueProp="checked">
                  <Switch />
                </Form.Field>
              );
            }
            if (field.type === 'select') {
              return (
                <Form.Field key={field.key} {...commonProps}>
                  <Select options={field.options ?? []} />
                </Form.Field>
              );
            }
            if (field.type === 'date') {
              return (
                <Form.Field key={field.key} {...commonProps}>
                  <Input type="date" />
                </Form.Field>
              );
            }
            return (
              <Form.Field key={field.key} {...commonProps}>
                <Input />
              </Form.Field>
            );
          })}
          <Button htmlType="submit" icon={<Save size={16} />} loading={saving} type="primary">
            {t(
              recordId ? 'moduleApps.runtime.records.update' : 'moduleApps.runtime.records.create',
            )}
          </Button>
        </Form>
      </Flexbox>
    );
  },
);

RecordForm.displayName = 'RecordForm';

export default RecordForm;
