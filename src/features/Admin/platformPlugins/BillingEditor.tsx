'use client';

import { Form, InputNumber } from 'antd';
import { memo } from 'react';

type BillingEditorProps = {
  showModuleMultiplier?: boolean;
};

const BillingEditor = memo<BillingEditorProps>(({ showModuleMultiplier = true }) => (
  <>
    <Form.Item
      extra="AI 实际成本会乘以插件默认倍率，再乘以模块倍率。"
      label="插件默认倍率"
      name="defaultMultiplier"
    >
      <InputNumber min={0} precision={2} step={0.05} style={{ width: '100%' }} />
    </Form.Item>
    {showModuleMultiplier ? (
      <Form.Item label="模块倍率" name="moduleMultiplier">
        <InputNumber min={0} precision={2} step={0.05} style={{ width: '100%' }} />
      </Form.Item>
    ) : null}
    <Form.Item label="固定服务费积分" name="fixedServiceFeeCredits">
      <InputNumber min={0} precision={0} style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item extra="P1 先作为独立字段记录外部 API 成本。" label="外部 API 成本积分" name="externalApiCostCredits">
      <InputNumber min={0} precision={0} style={{ width: '100%' }} />
    </Form.Item>
  </>
));

BillingEditor.displayName = 'BillingEditor';

export default BillingEditor;
