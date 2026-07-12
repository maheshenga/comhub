'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Form, Input, InputNumber, Select, Typography } from 'antd';
import { memo } from 'react';

const runtimeTypeOptions = [
  'none',
  'record_create',
  'record_update',
  'record_archive',
  'api_action',
  'server_action',
  'content_generation',
  'workflow_step',
].map((value) => ({ label: value, value }));

const ActionEditor = memo(() => {
  return (
    <Flexbox data-testid="admin-module-app-action-editor" gap={12}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        Actions
      </Typography.Title>
      <Form.List name="actions">
        {(fields, { add, remove }) => (
          <Flexbox gap={12}>
            {fields.map((field, index) => (
              <Flexbox key={field.key} gap={8} padding={12} style={{ border: '1px solid #eee', borderRadius: 8 }}>
                <Flexbox horizontal gap={12}>
                  <Form.Item label="Action ID" name={[field.name, 'id']} rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Input placeholder="create_record" />
                  </Form.Item>
                  <Form.Item label="Name" name={[field.name, 'name']} rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Input placeholder={`Action ${index + 1}`} />
                  </Form.Item>
                </Flexbox>
                <Flexbox horizontal gap={12}>
                  <Form.Item label="Runtime type" name={[field.name, 'runtimeType']} rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Select options={runtimeTypeOptions} />
                  </Form.Item>
                  <Form.Item label="Module multiplier" name={[field.name, 'moduleMultiplier']} style={{ width: 180 }}>
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Flexbox>
                <Form.Item label="Input schema JSON" name={[field.name, 'inputSchemaJson']}>
                  <Input.TextArea autoSize={{ maxRows: 5, minRows: 2 }} placeholder={'{\n  "fields": []\n}'} />
                </Form.Item>
                <Form.Item label="Output schema JSON" name={[field.name, 'outputSchemaJson']}>
                  <Input.TextArea autoSize={{ maxRows: 5, minRows: 2 }} placeholder="{}" />
                </Form.Item>
                <Form.Item label="Runtime config JSON" name={[field.name, 'runtimeConfigJson']}>
                  <Input.TextArea autoSize={{ maxRows: 5, minRows: 2 }} placeholder="{}" />
                </Form.Item>
                <Button danger onClick={() => remove(field.name)}>
                  Remove action
                </Button>
              </Flexbox>
            ))}
            <Button
              onClick={() =>
                add({
                  id: 'create_record',
                  inputSchemaJson: '{\n  "fields": []\n}',
                  moduleMultiplier: 1,
                  name: 'Create record',
                  outputSchemaJson: '{}',
                  runtimeConfigJson: '{}',
                  runtimeType: 'record_create',
                })
              }
            >
              Add action
            </Button>
          </Flexbox>
        )}
      </Form.List>
    </Flexbox>
  );
});

ActionEditor.displayName = 'ActionEditor';

export default ActionEditor;
