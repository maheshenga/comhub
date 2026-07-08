'use client';

import { Flexbox } from '@lobehub/ui';
import { Form, Input, InputNumber, Switch } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const OperationsEditor = memo(() => {
  const { t } = useTranslation('subscription');
  const tt = (key: string) => t(key as never);

  return (
    <Flexbox gap={12}>
      <Flexbox horizontal gap={12}>
        <Form.Item label={tt('admin.platformPlugins.featured')} name="featured" style={{ width: 160 }} valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label={tt('admin.platformPlugins.sortWeight')} name="sortWeight" style={{ flex: 1 }}>
          <InputNumber max={100_000} min={-100_000} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      </Flexbox>
      <Flexbox horizontal gap={12}>
        <Form.Item label={tt('admin.platformPlugins.promotionLabel')} name="promoLabel" style={{ flex: 1 }}>
          <Input maxLength={80} />
        </Form.Item>
        <Form.Item label={tt('admin.platformPlugins.upgradeCta')} name="upgradeCta" style={{ flex: 1 }}>
          <Input maxLength={160} />
        </Form.Item>
      </Flexbox>
      <Form.Item label={tt('admin.platformPlugins.useCase')} name="useCase">
        <Input.TextArea autoSize={{ maxRows: 3, minRows: 2 }} maxLength={500} />
      </Form.Item>
      <Form.Item label={tt('admin.platformPlugins.planBenefitSummary')} name="planBenefitSummary">
        <Input.TextArea autoSize={{ maxRows: 3, minRows: 2 }} maxLength={300} />
      </Form.Item>
    </Flexbox>
  );
});

OperationsEditor.displayName = 'OperationsEditor';

export default OperationsEditor;
