'use client';

import { Button, Flexbox, Input, InputNumber, Select, TextArea } from '@lobehub/ui';
import { Form } from '@lobehub/ui/form';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const RUNTIME_TYPES = [
  'none',
  'record_create',
  'record_update',
  'record_archive',
  'api_action',
  'server_action',
  'content_generation',
  'workflow_step',
  'executable_action',
] as const;

const ActionEditor = memo<{ disabled?: boolean }>(({ disabled }) => {
  const { t } = useTranslation('common');
  const runtimeTypeOptions = RUNTIME_TYPES.map((value) => ({
    label: t(`moduleApps.admin.configuration.runtimeTypeOptions.${value}`),
    value,
  }));

  return (
    <Flexbox data-testid="admin-module-app-action-editor" gap={12}>
      <h3>{t('moduleApps.admin.configuration.actions')}</h3>
      <Form.List name="actions">
        {({ add, fields, remove }) => (
          <Flexbox gap={12}>
            {fields.map((field, index) => (
              <Flexbox gap={8} key={field.key}>
                <Flexbox horizontal gap={12}>
                  <Form.Field
                    required
                    label={t('moduleApps.admin.configuration.actionId')}
                    name={`${field.name}.id`}
                    style={{ flex: 1 }}
                  >
                    <Input
                      disabled={disabled}
                      placeholder={t('moduleApps.admin.configuration.actionIdPlaceholder')}
                    />
                  </Form.Field>
                  <Form.Field
                    required
                    label={t('moduleApps.admin.configuration.actionName')}
                    name={`${field.name}.name`}
                    style={{ flex: 1 }}
                  >
                    <Input
                      disabled={disabled}
                      placeholder={t('moduleApps.admin.configuration.actionNamePlaceholder', {
                        index: index + 1,
                      })}
                    />
                  </Form.Field>
                </Flexbox>
                <Flexbox horizontal gap={12}>
                  <Form.Field
                    required
                    label={t('moduleApps.admin.configuration.runtimeType')}
                    name={`${field.name}.runtimeType`}
                    style={{ flex: 1 }}
                  >
                    <Select disabled={disabled} options={runtimeTypeOptions} />
                  </Form.Field>
                  <Form.Field
                    label={t('moduleApps.admin.configuration.moduleMultiplier')}
                    name={`${field.name}.moduleMultiplier`}
                    style={{ width: 180 }}
                  >
                    <InputNumber
                      disabled={disabled}
                      min={0}
                      precision={2}
                      style={{ width: '100%' }}
                    />
                  </Form.Field>
                </Flexbox>
                <Form.Field
                  label={t('moduleApps.admin.configuration.inputSchemaJson')}
                  name={`${field.name}.inputSchemaJson`}
                >
                  <TextArea
                    autoSize={{ maxRows: 5, minRows: 2 }}
                    disabled={disabled}
                    placeholder={'{\n  "fields": []\n}'}
                  />
                </Form.Field>
                <Form.Field
                  label={t('moduleApps.admin.configuration.outputSchemaJson')}
                  name={`${field.name}.outputSchemaJson`}
                >
                  <TextArea
                    autoSize={{ maxRows: 5, minRows: 2 }}
                    disabled={disabled}
                    placeholder="{}"
                  />
                </Form.Field>
                <Form.Field
                  label={t('moduleApps.admin.configuration.runtimeConfigJson')}
                  name={`${field.name}.runtimeConfigJson`}
                >
                  <TextArea
                    autoSize={{ maxRows: 5, minRows: 2 }}
                    disabled={disabled}
                    placeholder="{}"
                  />
                </Form.Field>
                <Button
                  danger
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    remove(field.index);
                  }}
                >
                  {t('moduleApps.admin.configuration.removeAction')}
                </Button>
              </Flexbox>
            ))}
            <Button
              disabled={disabled}
              onClick={() =>
                disabled
                  ? undefined
                  : add({
                      id: 'create_record',
                      inputSchemaJson: '{\n  "fields": []\n}',
                      moduleMultiplier: 1,
                      name: t('moduleApps.admin.configuration.newActionName'),
                      outputSchemaJson: '{}',
                      runtimeConfigJson: '{}',
                      runtimeType: 'record_create',
                    })
              }
            >
              {t('moduleApps.admin.configuration.addAction')}
            </Button>
          </Flexbox>
        )}
      </Form.List>
    </Flexbox>
  );
});

ActionEditor.displayName = 'ActionEditor';

export default ActionEditor;
