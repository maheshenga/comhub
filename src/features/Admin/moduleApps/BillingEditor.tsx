'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Form, InputNumber, Select, Typography } from 'antd';
import { memo } from 'react';

const chargeModeOptions = ['free', 'fixed', 'ai_usage', 'external_api', 'hybrid'].map((value) => ({
  label: value,
  value,
}));

const BillingEditor = memo(() => {
  return (
    <Flexbox data-testid="admin-module-app-billing-editor" gap={12}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        Billing
      </Typography.Title>
      <Alert
        showIcon
        message="P2-A stores billing configuration only; real credit ledger posting is not enabled in this editor."
        type="info"
      />
      <Flexbox horizontal gap={12}>
        <Form.Item label="Charge mode" name={['billing', 'chargeMode']} style={{ flex: 1 }}>
          <Select aria-label="Charge mode" options={chargeModeOptions} />
        </Form.Item>
        <Form.Item label="Default multiplier" name={['billing', 'defaultMultiplier']} style={{ flex: 1 }}>
          <InputNumber min={0} precision={2} style={{ width: '100%' }} />
        </Form.Item>
      </Flexbox>
      <Flexbox horizontal gap={12}>
        <Form.Item label="Fixed service fee credits" name={['billing', 'fixedServiceFeeCredits']} style={{ flex: 1 }}>
          <InputNumber min={0} precision={2} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="External API cost credits" name={['billing', 'externalApiCostCredits']} style={{ flex: 1 }}>
          <InputNumber min={0} precision={2} style={{ width: '100%' }} />
        </Form.Item>
      </Flexbox>
      <Form.Item label="Failure fixed fee policy" name={['billing', 'failureFixedFeePolicy']}>
        <Select
          options={[
            {
              label: 'do_not_charge',
              value: 'do_not_charge',
            },
          ]}
        />
      </Form.Item>
    </Flexbox>
  );
});

BillingEditor.displayName = 'BillingEditor';

export default BillingEditor;
