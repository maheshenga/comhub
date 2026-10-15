'use client';

import { Flexbox } from '@lobehub/ui';
import { Avatar, Text } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/Form.Item name+rules）与受控字段绑定，无 base-ui 行为不变等价物；迁 FormKit 属另行立项。
import { Form, type FormInstance } from 'antd';

import type { CardFormValue } from './shared';


const SpacePreview = ({ form, name }: { form: FormInstance<any>; name: number }) => (
  <Form.Item noStyle shouldUpdate>
    {() => {
      const card = form.getFieldValue(['cards', name]) as CardFormValue | undefined;
      return (
        <Flexbox horizontal align="center" gap={8}>
          <Avatar avatar={card?.avatar} size={32} title={card?.title ?? ''} />
          <Text strong>{card?.title || '新卡片'}</Text>
        </Flexbox>
      );
    }}
  </Form.Item>
);

export default SpacePreview;
