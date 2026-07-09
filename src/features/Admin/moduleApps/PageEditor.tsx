'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Form, Input, InputNumber, Select, Typography } from 'antd';
import { memo } from 'react';

const pageTypeOptions = ['overview', 'form', 'list', 'detail', 'result', 'artifact', 'custom'].map(
  (value) => ({ label: value, value }),
);

const PageEditor = memo(() => {
  return (
    <Flexbox data-testid="admin-module-app-page-editor" gap={12}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        Pages
      </Typography.Title>
      <Form.List name="pages">
        {(fields, { add, remove }) => (
          <Flexbox gap={12}>
            {fields.map((field, index) => (
              <Flexbox key={field.key} gap={8} padding={12} style={{ border: '1px solid #eee', borderRadius: 8 }}>
                <Flexbox horizontal gap={12}>
                  <Form.Item label="Key" name={[field.name, 'key']} rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Input placeholder="overview" />
                  </Form.Item>
                  <Form.Item label="Title" name={[field.name, 'title']} rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Input placeholder={`Page ${index + 1}`} />
                  </Form.Item>
                </Flexbox>
                <Flexbox horizontal gap={12}>
                  <Form.Item label="Type" name={[field.name, 'type']} rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Select options={pageTypeOptions} />
                  </Form.Item>
                  <Form.Item label="Route path" name={[field.name, 'routePath']} rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Input placeholder="/" />
                  </Form.Item>
                  <Form.Item label="Sort order" name={[field.name, 'sortOrder']} style={{ width: 140 }}>
                    <InputNumber precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Flexbox>
                <Form.Item label="Data source JSON" name={[field.name, 'dataSourceJson']}>
                  <Input.TextArea autoSize={{ maxRows: 5, minRows: 2 }} placeholder={'{\n  "collectionKey": "records"\n}'} />
                </Form.Item>
                <Form.Item label="Layout schema JSON" name={[field.name, 'layoutSchemaJson']}>
                  <Input.TextArea autoSize={{ maxRows: 5, minRows: 2 }} placeholder="{}" />
                </Form.Item>
                <Form.Item label="Action bindings JSON" name={[field.name, 'actionBindingsJson']}>
                  <Input.TextArea autoSize={{ maxRows: 5, minRows: 2 }} placeholder={'[{ "event": "submit", "actionKey": "create_record" }]'} />
                </Form.Item>
                <Button danger onClick={() => remove(field.name)}>
                  Remove page
                </Button>
              </Flexbox>
            ))}
            <Button onClick={() => add({ key: 'overview', routePath: '/', title: 'Overview', type: 'overview' })}>
              Add page
            </Button>
          </Flexbox>
        )}
      </Form.List>
    </Flexbox>
  );
});

PageEditor.displayName = 'PageEditor';

export default PageEditor;
