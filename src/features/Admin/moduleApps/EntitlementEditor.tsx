'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Form, Input, InputNumber, Switch, Typography } from 'antd';
import { memo } from 'react';

const EntitlementEditor = memo(() => {
  return (
    <Flexbox data-testid="admin-module-app-entitlement-editor" gap={12}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        Plan entitlements
      </Typography.Title>
      <Form.List name="entitlements">
        {(fields, { add, remove }) => (
          <Flexbox gap={12}>
            {fields.map((field) => (
              <Flexbox key={field.key} gap={8} padding={12} style={{ border: '1px solid #eee', borderRadius: 8 }}>
                <Flexbox horizontal gap={12}>
                  <Form.Item label="Plan" name={[field.name, 'plan']} rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Input placeholder="pro" />
                  </Form.Item>
                  <Form.Item label="Free quota credits" name={[field.name, 'freeQuotaCredits']} style={{ flex: 1 }}>
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="Discount percent" name={[field.name, 'discountPercent']} style={{ flex: 1 }}>
                    <InputNumber max={100} min={0} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Flexbox>
                <Flexbox horizontal gap={24}>
                  <Form.Item label="Visible" name={[field.name, 'visible']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="Installable" name={[field.name, 'installable']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="Runnable" name={[field.name, 'runnable']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Flexbox>
                <Button danger onClick={() => remove(field.name)}>
                  Remove entitlement
                </Button>
              </Flexbox>
            ))}
            <Button
              onClick={() =>
                add({
                  discountPercent: 0,
                  freeQuotaCredits: 0,
                  installable: true,
                  plan: 'pro',
                  runnable: true,
                  visible: true,
                })
              }
            >
              Add entitlement
            </Button>
          </Flexbox>
        )}
      </Form.List>
    </Flexbox>
  );
});

EntitlementEditor.displayName = 'EntitlementEditor';

export default EntitlementEditor;
