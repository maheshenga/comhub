'use client';

import { Input, Switch, TextArea } from '@lobehub/ui';
import { Form } from '@lobehub/ui/form';

import { AdminFormGrid, AdminSection } from '../layout';

const EntryMetaFields = () => (
  <AdminSection carded description="设置侧栏入口状态、公开栏目名称和页面分类。" title="入口与页面">
    <AdminFormGrid>
      <Form.Field label="启用侧栏入口" name="enabled" valueProp="checked">
        <Switch />
      </Form.Field>
      <Form.Field label="栏目名称" name="name" required="请填写栏目名称">
        <Input placeholder="专家广场" />
      </Form.Field>
    </AdminFormGrid>
    <Form.Field label="页面说明" name="description">
      <TextArea autoSize={{ minRows: 2 }} />
    </Form.Field>
    <Form.Field extra="每行一个分类，也支持逗号分隔。" label="分类列表" name="categoriesText">
      <TextArea autoSize={{ minRows: 4 }} />
    </Form.Field>
  </AdminSection>
);

export default EntryMetaFields;
