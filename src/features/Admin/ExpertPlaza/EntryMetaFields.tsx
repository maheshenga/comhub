'use client';

import { Input, Switch, TextArea } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/Form.Item name+rules）与受控字段绑定，无 base-ui 行为不变等价物；迁 FormKit 属另行立项。
import { Form } from 'antd';

import { AdminFormGrid, AdminSection } from '../layout';

const EntryMetaFields = () => (
  <AdminSection carded description="设置侧栏入口状态、公开栏目名称和页面分类。" title="入口与页面">
    <AdminFormGrid>
      <Form.Item label="启用侧栏入口" name="enabled" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item
        label="栏目名称"
        name="name"
        rules={[{ message: '请填写栏目名称', required: true }]}
      >
        <Input placeholder="专家广场" />
      </Form.Item>
    </AdminFormGrid>
    <Form.Item label="页面说明" name="description">
      <TextArea autoSize={{ minRows: 2 }} />
    </Form.Item>
    <Form.Item extra="每行一个分类，也支持逗号分隔。" label="分类列表" name="categoriesText">
      <TextArea autoSize={{ minRows: 4 }} />
    </Form.Item>
  </AdminSection>
);

export default EntryMetaFields;
