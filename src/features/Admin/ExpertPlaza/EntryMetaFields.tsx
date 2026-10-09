'use client';

import { Form, Input, Switch } from 'antd';

import { AdminFormGrid, AdminSection } from '../layout';

const EntryMetaFields = () => (
  <AdminSection description="设置侧栏入口状态、公开栏目名称和页面分类。" title="入口与页面">
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
      <Input.TextArea autoSize={{ minRows: 2 }} />
    </Form.Item>
    <Form.Item
      extra="每行一个分类，也支持逗号分隔。"
      label="分类列表"
      name="categoriesText"
    >
      <Input.TextArea autoSize={{ minRows: 4 }} />
    </Form.Item>
  </AdminSection>
);

export default EntryMetaFields;
