'use client';

import { Avatar, Flexbox, Text } from '@lobehub/ui';
import { type FormInstance, useWatch } from '@lobehub/ui/form';

import type { CardFormValue, FormValues } from './shared';

const SpacePreview = ({ form, name }: { form: FormInstance<FormValues>; name: number }) => {
  const card = useWatch(form, (values) => values.cards?.[name]) as CardFormValue | undefined;

  return (
    <Flexbox horizontal align="center" gap={8}>
      <Avatar avatar={card?.avatar} size={32} title={card?.title ?? ''} />
      <Text strong>{card?.title || '新卡片'}</Text>
    </Flexbox>
  );
};

export default SpacePreview;
