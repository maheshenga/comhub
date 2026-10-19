'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Input, Switch, TextArea, Tooltip } from '@lobehub/ui/base-ui';
import { Form, type FormInstance } from '@lobehub/ui/base-ui/form';
import { Plus, Trash2 } from 'lucide-react';

import { Card } from '@/components/antd-compat/Card';

import { AdminFormGrid, AdminSection } from '../layout';
import type { FormValues } from './shared';
import SpacePreview from './SpacePreview';

const CardListFields = ({ form }: { form: FormInstance<FormValues> }) => (
  <AdminSection
    carded
    description="卡片按列表顺序展示；必填标题和描述，ID 留空时会根据标题生成。"
    title="卡片信息"
  >
    <Form.List name="cards">
      {(list) => (
        <Flexbox gap={12}>
          {list.fields.map((field) => (
            <Card
              key={field.key}
              size="small"
              title={<SpacePreview form={form} name={field.index} />}
              extra={
                <Tooltip title="删除卡片">
                  <Button
                    danger
                    aria-label="删除卡片"
                    icon={<Trash2 aria-hidden size={16} />}
                    size="small"
                    onClick={() => list.remove(field.index)}
                  />
                </Tooltip>
              }
            >
              <Flexbox gap={12}>
                <AdminFormGrid columns={3}>
                  <Form.Field label="ID" name={`${field.name}.id`}>
                    <Input placeholder="finance-advisor" />
                  </Form.Field>
                  <Form.Field label="标题" name={`${field.name}.title`} required="请填写标题">
                    <Input placeholder="财务顾问" />
                  </Form.Field>
                  <Form.Field label="分类" name={`${field.name}.category`}>
                    <Input placeholder="办公" />
                  </Form.Field>
                </AdminFormGrid>
                <Form.Field label="描述" name={`${field.name}.description`} required="请填写描述">
                  <TextArea autoSize={{ minRows: 2 }} />
                </Form.Field>
                <AdminFormGrid>
                  <Form.Field label="头像 / 图标地址" name={`${field.name}.avatar`}>
                    <Input placeholder="/images/avatar-presets/avatar-1.svg" />
                  </Form.Field>
                  <Form.Field label="跳转链接" name={`${field.name}.url`}>
                    <Input placeholder="/market/..." />
                  </Form.Field>
                </AdminFormGrid>
                <AdminFormGrid columns={3}>
                  <Form.Field label="作者/来源" name={`${field.name}.author`}>
                    <Input />
                  </Form.Field>
                  <Form.Field label="指标名称" name={`${field.name}.metricLabel`}>
                    <Input placeholder="使用人数" />
                  </Form.Field>
                  <Form.Field label="指标值" name={`${field.name}.metricValue`}>
                    <Input placeholder="1.2k" />
                  </Form.Field>
                </AdminFormGrid>
                <Form.Field
                  extra="每行一个标签，也支持逗号分隔。"
                  label="标签"
                  name={`${field.name}.tagsText`}
                >
                  <TextArea autoSize={{ minRows: 2 }} />
                </Form.Field>
                <AdminFormGrid>
                  <Form.Field label="启用" name={`${field.name}.enabled`} valueProp="checked">
                    <Switch />
                  </Form.Field>
                  <Form.Field label="精选" name={`${field.name}.featured`} valueProp="checked">
                    <Switch />
                  </Form.Field>
                </AdminFormGrid>
              </Flexbox>
            </Card>
          ))}
          <Button
            block
            icon={<Plus aria-hidden size={16} />}
            type="dashed"
            onClick={() =>
              list.add({
                description: '',
                enabled: true,
                featured: false,
                id: '',
                tagsText: '',
                title: '',
              })
            }
          >
            添加卡片
          </Button>
        </Flexbox>
      )}
    </Form.List>
  </AdminSection>
);

export default CardListFields;
