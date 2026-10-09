'use client';

import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Form, type FormInstance, Input, Switch, Tooltip } from 'antd';
import { Plus, Trash2 } from 'lucide-react';

import { Card } from '@/components/antd-compat/Card';

import { AdminFormGrid, AdminSection } from '../layout';
import SpacePreview from './SpacePreview';

const CardListFields = ({ form }: { form: FormInstance<any> }) => (
  <AdminSection
    description="卡片按列表顺序展示；必填标题和描述，ID 留空时会根据标题生成。"
    title="卡片信息"
  >
    <Form.List name="cards">
      {(fields, { add, remove }) => (
        <Flexbox gap={12}>
          {fields.map(({ key, name, ...restField }) => (
            <Card
              key={key}
              size="small"
              title={<SpacePreview form={form} name={name} />}
              extra={
                <Tooltip title="删除卡片">
                  <Button
                    danger
                    aria-label="删除卡片"
                    icon={<Trash2 aria-hidden size={16} />}
                    size="small"
                    onClick={() => remove(name)}
                  />
                </Tooltip>
              }
            >
              <Flexbox gap={12}>
                <AdminFormGrid columns={3}>
                  <Form.Item {...restField} label="ID" name={[name, 'id']}>
                    <Input placeholder="finance-advisor" />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    label="标题"
                    name={[name, 'title']}
                    rules={[{ message: '请填写标题', required: true }]}
                  >
                    <Input placeholder="财务顾问" />
                  </Form.Item>
                  <Form.Item {...restField} label="分类" name={[name, 'category']}>
                    <Input placeholder="办公" />
                  </Form.Item>
                </AdminFormGrid>
                <Form.Item
                  {...restField}
                  label="描述"
                  name={[name, 'description']}
                  rules={[{ message: '请填写描述', required: true }]}
                >
                  <Input.TextArea autoSize={{ minRows: 2 }} />
                </Form.Item>
                <AdminFormGrid>
                  <Form.Item {...restField} label="头像 / 图标地址" name={[name, 'avatar']}>
                    <Input placeholder="/images/avatar-presets/avatar-1.svg" />
                  </Form.Item>
                  <Form.Item {...restField} label="跳转链接" name={[name, 'url']}>
                    <Input placeholder="/market/..." />
                  </Form.Item>
                </AdminFormGrid>
                <AdminFormGrid columns={3}>
                  <Form.Item {...restField} label="作者/来源" name={[name, 'author']}>
                    <Input />
                  </Form.Item>
                  <Form.Item {...restField} label="指标名称" name={[name, 'metricLabel']}>
                    <Input placeholder="使用人数" />
                  </Form.Item>
                  <Form.Item {...restField} label="指标值" name={[name, 'metricValue']}>
                    <Input placeholder="1.2k" />
                  </Form.Item>
                </AdminFormGrid>
                <Form.Item
                  {...restField}
                  extra="每行一个标签，也支持逗号分隔。"
                  label="标签"
                  name={[name, 'tagsText']}
                >
                  <Input.TextArea autoSize={{ minRows: 2 }} />
                </Form.Item>
                <AdminFormGrid>
                  <Form.Item
                    {...restField}
                    label="启用"
                    name={[name, 'enabled']}
                    valuePropName="checked"
                  >
                    <Switch defaultChecked />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    label="精选"
                    name={[name, 'featured']}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </AdminFormGrid>
              </Flexbox>
            </Card>
          ))}
          <Button
            block
            icon={<Plus aria-hidden size={16} />}
            type="dashed"
            onClick={() =>
              add({
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
