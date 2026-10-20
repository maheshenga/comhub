'use client';

import { Flexbox, InputNumber, Select } from '@lobehub/ui';
import { Form } from '@lobehub/ui/form';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const CHARGE_MODES = ['free', 'fixed', 'ai_usage', 'external_api', 'hybrid'] as const;

const BillingEditor = memo<{ disabled?: boolean }>(({ disabled }) => {
  const { t } = useTranslation('common');
  const chargeModeOptions = CHARGE_MODES.map((value) => ({
    label: t(`moduleApps.admin.entitlements.chargeModeOptions.${value}`),
    value,
  }));

  return (
    <Flexbox data-testid="admin-module-app-billing-editor" gap={12}>
      <h3>{t('moduleApps.admin.entitlements.billing')}</h3>
      <p>{t('moduleApps.admin.entitlements.billingNotice')}</p>
      <Flexbox horizontal gap={12}>
        <Form.Field
          label={t('moduleApps.admin.entitlements.chargeMode')}
          name="billing.chargeMode"
          style={{ flex: 1 }}
        >
          <Select
            aria-label={t('moduleApps.admin.entitlements.chargeMode')}
            disabled={disabled}
            options={chargeModeOptions}
          />
        </Form.Field>
        <Form.Field
          label={t('moduleApps.admin.entitlements.defaultMultiplier')}
          name="billing.defaultMultiplier"
          style={{ flex: 1 }}
        >
          <InputNumber
            disabled={disabled}
            max={100}
            min={0}
            precision={2}
            style={{ width: '100%' }}
          />
        </Form.Field>
      </Flexbox>
      <Flexbox horizontal gap={12}>
        <Form.Field
          label={t('moduleApps.admin.entitlements.fixedServiceFeeCredits')}
          name="billing.fixedServiceFeeCredits"
          style={{ flex: 1 }}
        >
          <InputNumber disabled={disabled} min={0} precision={2} style={{ width: '100%' }} />
        </Form.Field>
        <Form.Field
          label={t('moduleApps.admin.entitlements.externalApiCostCredits')}
          name="billing.externalApiCostCredits"
          style={{ flex: 1 }}
        >
          <InputNumber disabled={disabled} min={0} precision={2} style={{ width: '100%' }} />
        </Form.Field>
      </Flexbox>
      <Form.Field
        label={t('moduleApps.admin.entitlements.failureFixedFeePolicy')}
        name="billing.failureFixedFeePolicy"
      >
        <Select
          disabled={disabled}
          options={[
            {
              label: t('moduleApps.admin.entitlements.failureFixedFeePolicyOptions.doNotCharge'),
              value: 'do_not_charge',
            },
          ]}
        />
      </Form.Field>
    </Flexbox>
  );
});

BillingEditor.displayName = 'BillingEditor';

export default BillingEditor;
