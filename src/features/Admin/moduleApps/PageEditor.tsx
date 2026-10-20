'use client';

import { Button, Flexbox, Input, InputNumber, Select, TextArea } from '@lobehub/ui';
import { Form } from '@lobehub/ui/form';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const PAGE_TYPES = ['overview', 'form', 'list', 'detail', 'result', 'artifact', 'custom'] as const;

const PageEditor = memo<{ disabled?: boolean }>(({ disabled }) => {
  const { t } = useTranslation('common');
  const pageTypeOptions = PAGE_TYPES.map((value) => ({
    label: t(`moduleApps.admin.configuration.pageTypeOptions.${value}`),
    value,
  }));

  return (
    <Flexbox data-testid="admin-module-app-page-editor" gap={12}>
      <h3>{t('moduleApps.admin.configuration.pages')}</h3>
      <Form.List name="pages">
        {({ add, fields, remove }) => (
          <Flexbox gap={12}>
            {fields.map((field, index) => (
              <Flexbox gap={8} key={field.key}>
                <Flexbox horizontal gap={12}>
                  <Form.Field
                    required
                    label={t('moduleApps.admin.configuration.pageKey')}
                    name={`${field.name}.key`}
                    style={{ flex: 1 }}
                  >
                    <Input
                      disabled={disabled}
                      placeholder={t('moduleApps.admin.configuration.pageKeyPlaceholder')}
                    />
                  </Form.Field>
                  <Form.Field
                    required
                    label={t('moduleApps.admin.configuration.pageTitle')}
                    name={`${field.name}.title`}
                    style={{ flex: 1 }}
                  >
                    <Input
                      disabled={disabled}
                      placeholder={t('moduleApps.admin.configuration.pageTitlePlaceholder', {
                        index: index + 1,
                      })}
                    />
                  </Form.Field>
                </Flexbox>
                <Flexbox horizontal gap={12}>
                  <Form.Field
                    required
                    label={t('moduleApps.admin.configuration.pageType')}
                    name={`${field.name}.type`}
                    style={{ flex: 1 }}
                  >
                    <Select disabled={disabled} options={pageTypeOptions} />
                  </Form.Field>
                  <Form.Field
                    required
                    label={t('moduleApps.admin.configuration.routePath')}
                    name={`${field.name}.routePath`}
                    style={{ flex: 1 }}
                  >
                    <Input disabled={disabled} placeholder="/" />
                  </Form.Field>
                  <Form.Field
                    label={t('moduleApps.admin.configuration.sortOrder')}
                    name={`${field.name}.sortOrder`}
                    style={{ width: 140 }}
                  >
                    <InputNumber disabled={disabled} precision={0} style={{ width: '100%' }} />
                  </Form.Field>
                </Flexbox>
                <Form.Field
                  label={t('moduleApps.admin.configuration.dataSourceJson')}
                  name={`${field.name}.dataSourceJson`}
                >
                  <TextArea
                    autoSize={{ maxRows: 5, minRows: 2 }}
                    disabled={disabled}
                    placeholder={'{\n  "collectionKey": "records"\n}'}
                  />
                </Form.Field>
                <Form.Field
                  label={t('moduleApps.admin.configuration.layoutSchemaJson')}
                  name={`${field.name}.layoutSchemaJson`}
                >
                  <TextArea
                    autoSize={{ maxRows: 5, minRows: 2 }}
                    disabled={disabled}
                    placeholder="{}"
                  />
                </Form.Field>
                <Form.Field
                  label={t('moduleApps.admin.configuration.actionBindingsJson')}
                  name={`${field.name}.actionBindingsJson`}
                >
                  <TextArea
                    autoSize={{ maxRows: 5, minRows: 2 }}
                    disabled={disabled}
                    placeholder={'[{ "event": "submit", "actionKey": "create_record" }]'}
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
                  {t('moduleApps.admin.configuration.removePage')}
                </Button>
              </Flexbox>
            ))}
            <Button
              disabled={disabled}
              onClick={() =>
                disabled
                  ? undefined
                  : add({
                      key: 'overview',
                      routePath: '/',
                      title: t('moduleApps.admin.configuration.newPageTitle'),
                      type: 'overview',
                    })
              }
            >
              {t('moduleApps.admin.configuration.addPage')}
            </Button>
          </Flexbox>
        )}
      </Form.List>
    </Flexbox>
  );
});

PageEditor.displayName = 'PageEditor';

export default PageEditor;
