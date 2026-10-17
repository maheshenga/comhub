'use client';

import { Flexbox } from '@lobehub/ui';
import { Input, InputNumber } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/Form.Item name+rules）与受控字段绑定，无 base-ui 行为不变等价物；迁 FormKit 属另行立项。
import { Form } from 'antd';
import { useTranslation } from 'react-i18next';

export const GroupFieldsRow = () => {
  const { t } = useTranslation('subscription');

  return (
    <Flexbox horizontal gap={12}>
      <Form.Item
        label={t('admin.providers.field.groupKey', '分组 Key')}
        name="groupKey"
        style={{ flex: 1 }}
        extra={t(
          'admin.providers.field.groupKeyHint',
          '用于套餐授权和分组计费；未区分时使用 default。',
        )}
      >
        <Input placeholder="default / basic / pro" />
      </Form.Item>
      <Form.Item
        label={t('admin.providers.field.groupName', '分组名称')}
        name="groupName"
        style={{ flex: 1 }}
      >
        <Input placeholder="基础分组 / 专业分组" />
      </Form.Item>
      <Form.Item
        extra={t('admin.providers.field.groupMultiplierHint', '可选，用于记录上游分组成本倍率。')}
        label={t('admin.providers.field.groupMultiplier', '分组倍率')}
        name="groupMultiplier"
        style={{ flex: 1 }}
      >
        <InputNumber min={0} precision={4} step={0.1} style={{ width: '100%' }} />
      </Form.Item>
    </Flexbox>
  );
};

export default GroupFieldsRow;
