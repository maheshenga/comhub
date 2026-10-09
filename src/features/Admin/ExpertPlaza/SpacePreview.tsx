'use client';

import { Avatar, Flexbox  } from '@lobehub/ui';
import type { FormInstance } from 'antd';
import { Form, Typography } from 'antd';

import type { CardFormValue } from './shared';

const { Text } = Typography;

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
