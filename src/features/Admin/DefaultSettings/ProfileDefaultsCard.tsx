'use client';

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Flexbox } from '@lobehub/ui';
import { Avatar, Button, Input } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/Form.Item name+rules）与受控字段绑定，无 base-ui 行为不变等价物；迁 FormKit 属另行立项。
import { Form, type FormInstance } from 'antd';
import { cssVar } from 'antd-style';

import { Card } from '@/components/antd-compat/Card';
import ImageUrlUploadInput from '@/features/Admin/components/ImageUrlUploadInput';

import type { FormValues } from './shared';

interface ProfileDefaultsCardProps {
  form: FormInstance<FormValues>;
  uploadPublicUrlPrefix?: string;
}

export const ProfileDefaultsCard = ({ form, uploadPublicUrlPrefix }: ProfileDefaultsCardProps) => (
  <Card title="用户资料默认值">
    <Form.Item extra="用于注册引导和个人资料页的兴趣领域。" label="用户兴趣领域">
      <Form.List name="profileInterestAreas">
        {(fields, { add, remove }) => (
          <Flexbox gap={8}>
            {fields.map(({ key, name, ...restField }) => (
              <Flexbox horizontal align="center" gap={8} key={key}>
                <Form.Item {...restField} noStyle name={[name, 'key']}>
                  <Input placeholder="唯一标识" style={{ flex: 1 }} />
                </Form.Item>
                <Form.Item
                  {...restField}
                  noStyle
                  name={[name, 'label']}
                  rules={[{ message: '请填写显示名称', required: true }]}
                >
                  <Input placeholder="显示名称，例如 AI 绘画" style={{ flex: 1.4 }} />
                </Form.Item>
                <MinusCircleOutlined
                  style={{ color: cssVar.colorError }}
                  onClick={() => remove(name)}
                />
              </Flexbox>
            ))}
            <Button
              block
              icon={<PlusOutlined />}
              type="dashed"
              onClick={() => add({ key: '', label: '' })}
            >
              添加兴趣领域
            </Button>
          </Flexbox>
        )}
      </Form.List>
    </Form.Item>
    <Form.Item label="用户头像预设">
      <Form.List name="avatarPresets">
        {(fields, { add, remove }) => (
          <Flexbox gap={8}>
            {fields.map(({ key, name, ...restField }) => (
              <Flexbox horizontal align="center" gap={8} key={key}>
                <Form.Item noStyle shouldUpdate>
                  {() => (
                    <Avatar
                      avatar={form.getFieldValue(['avatarPresets', name, 'value'])}
                      size={32}
                      title=""
                    />
                  )}
                </Form.Item>
                <Form.Item
                  {...restField}
                  noStyle
                  name={[name, 'label']}
                  rules={[{ message: '请填写名称', required: true }]}
                >
                  <Input placeholder="名称" style={{ flex: 1 }} />
                </Form.Item>
                <Form.Item
                  {...restField}
                  noStyle
                  name={[name, 'value']}
                  rules={[{ message: '请填写头像地址', required: true }]}
                >
                  <ImageUrlUploadInput
                    placeholder="/images/avatar-presets/avatar-1.svg"
                    publicUrlPrefix={uploadPublicUrlPrefix}
                    style={{ flex: 2 }}
                  />
                </Form.Item>
                <MinusCircleOutlined
                  style={{ color: cssVar.colorError }}
                  onClick={() => remove(name)}
                />
              </Flexbox>
            ))}
            <Button
              block
              icon={<PlusOutlined />}
              type="dashed"
              onClick={() => add({ label: '', value: '' })}
            >
              添加头像
            </Button>
          </Flexbox>
        )}
      </Form.List>
    </Form.Item>
  </Card>
);

export default ProfileDefaultsCard;
