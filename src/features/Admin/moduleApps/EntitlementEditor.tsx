'use client';

import { Button, Flexbox, Input, InputNumber, Switch } from '@lobehub/ui';
import { Form } from '@lobehub/ui/form';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const EntitlementEditor = memo<{ disabled?: boolean }>(({ disabled }) => {
  const { t } = useTranslation('common');

  return (
    <Flexbox data-testid="admin-module-app-entitlement-editor" gap={12}>
      <h3>{t('moduleApps.admin.entitlements.entitlements')}</h3>
      <Form.List name="entitlements">
        {({ add, fields, remove }) => (
          <Flexbox gap={12}>
            {fields.map((field) => (
              <Flexbox gap={8} key={field.key}>
                <Flexbox horizontal gap={12}>
                  <Form.Field
                    required
                    label={t('moduleApps.admin.entitlements.plan')}
                    name={`${field.name}.plan`}
                    style={{ flex: 1 }}
                  >
                    <Input
                      disabled={disabled}
                      placeholder={t('moduleApps.admin.entitlements.planPlaceholder')}
                    />
                  </Form.Field>
                  <Form.Field
                    label={t('moduleApps.admin.entitlements.freeQuotaCredits')}
                    name={`${field.name}.freeQuotaCredits`}
                    style={{ flex: 1 }}
                  >
                    <InputNumber
                      disabled={disabled}
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                    />
                  </Form.Field>
                  <Form.Field
                    label={t('moduleApps.admin.entitlements.discountPercent')}
                    name={`${field.name}.discountPercent`}
                    style={{ flex: 1 }}
                  >
                    <InputNumber
                      disabled={disabled}
                      max={100}
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                    />
                  </Form.Field>
                </Flexbox>
                <Flexbox horizontal gap={24}>
                  <Form.Field
                    label={t('moduleApps.admin.entitlements.visible')}
                    name={`${field.name}.visible`}
                    valueProp="checked"
                  >
                    <Switch disabled={disabled} />
                  </Form.Field>
                  <Form.Field
                    label={t('moduleApps.admin.entitlements.installable')}
                    name={`${field.name}.installable`}
                    valueProp="checked"
                  >
                    <Switch disabled={disabled} />
                  </Form.Field>
                  <Form.Field
                    label={t('moduleApps.admin.entitlements.runnable')}
                    name={`${field.name}.runnable`}
                    valueProp="checked"
                  >
                    <Switch disabled={disabled} />
                  </Form.Field>
                </Flexbox>
                <Button
                  danger
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    remove(field.index);
                  }}
                >
                  {t('moduleApps.admin.entitlements.remove')}
                </Button>
              </Flexbox>
            ))}
            <Button
              disabled={disabled}
              onClick={() =>
                disabled
                  ? undefined
                  : add({
                      discountPercent: 0,
                      freeQuotaCredits: 0,
                      installable: true,
                      plan: 'pro',
                      runnable: true,
                      visible: true,
                    })
              }
            >
              {t('moduleApps.admin.entitlements.add')}
            </Button>
          </Flexbox>
        )}
      </Form.List>
    </Flexbox>
  );
});

EntitlementEditor.displayName = 'EntitlementEditor';

export default EntitlementEditor;
