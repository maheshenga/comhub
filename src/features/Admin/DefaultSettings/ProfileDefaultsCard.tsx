'use client';

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Avatar, Button, cssVar,Flexbox, Input } from '@lobehub/ui';
import { Form, type FormInstance, type FormListRenderProps } from '@lobehub/ui/form';

import { Card } from '@/components/antd-compat/Card';
import ImageUrlUploadInput from '@/features/Admin/components/ImageUrlUploadInput';

import type { FormValues } from './shared';

interface ProfileDefaultsCardProps {
  form: FormInstance<FormValues>;
  uploadPublicUrlPrefix?: string;
}

const renderInterestAreaRow =
  ({ add, remove }: Pick<FormListRenderProps, 'add' | 'remove'>) =>
  (fields: FormListRenderProps['fields']) => (
    <Flexbox gap={8}>
      {fields.map((field) => (
        <Flexbox horizontal align="center" gap={8} key={field.key}>
          <Form.Field bare name={`${field.name}.key`}>
            <Input placeholder="唯一标识" style={{ flex: 1 }} />
          </Form.Field>
          <Form.Field
            bare
            name={`${field.name}.label`}
            required="请填写显示名称"
            style={{ flex: 1.4 }}
          >
            <Input placeholder="显示名称，例如 AI 绘画" style={{ flex: 1.4 }} />
          </Form.Field>
          <MinusCircleOutlined
            style={{ color: cssVar.colorError }}
            onClick={() => remove(field.index)}
          />
        </Flexbox>
      ))}
      <Button block icon={<PlusOutlined />} type="dashed" onClick={() => add()}>
        添加兴趣领域
      </Button>
    </Flexbox>
  );

const renderAvatarRow =
  (
    { add, remove }: Pick<FormListRenderProps, 'add' | 'remove'>,
    form: FormInstance<FormValues>,
    uploadPublicUrlPrefix?: string,
  ) =>
  (fields: FormListRenderProps['fields']) => (
    <Flexbox gap={8}>
      {fields.map((field) => (
        <Flexbox horizontal align="center" gap={8} key={field.key}>
          <Avatar
            avatar={String(form.getValue(`avatarPresets.${field.index}.value` as any) ?? '')}
            size={32}
            title=""
          />
          <Form.Field bare name={`${field.name}.label`} required="请填写名称" style={{ flex: 1 }}>
            <Input placeholder="名称" style={{ flex: 1 }} />
          </Form.Field>
          <Form.Field
            bare
            name={`${field.name}.value`}
            required="请填写头像地址"
            style={{ flex: 2 }}
          >
            <ImageUrlUploadInput
              placeholder="/images/avatar-presets/avatar-1.svg"
              publicUrlPrefix={uploadPublicUrlPrefix}
              style={{ flex: 2 }}
            />
          </Form.Field>
          <MinusCircleOutlined
            style={{ color: cssVar.colorError }}
            onClick={() => remove(field.index)}
          />
        </Flexbox>
      ))}
      <Button block icon={<PlusOutlined />} type="dashed" onClick={() => add()}>
        添加头像
      </Button>
    </Flexbox>
  );

export const ProfileDefaultsCard = ({ form, uploadPublicUrlPrefix }: ProfileDefaultsCardProps) => (
  <Card title="用户资料默认值">
    <Form.Field extra="用于注册引导和个人资料页的兴趣领域。" label="用户兴趣领域">
      <Form.List name="profileInterestAreas" newItem={{ key: '', label: '' }}>
        {(props) => renderInterestAreaRow(props)(props.fields)}
      </Form.List>
    </Form.Field>
    <Form.Field label="用户头像预设">
      <Form.List name="avatarPresets" newItem={{ label: '', value: '' }}>
        {(props) => renderAvatarRow(props, form, uploadPublicUrlPrefix)(props.fields)}
      </Form.List>
    </Form.Field>
  </Card>
);

export default ProfileDefaultsCard;
