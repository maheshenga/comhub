'use client';

import type { PlatformPluginPlanEntitlement } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button, Empty, Form, InputNumber, Select, Switch } from 'antd';
import { memo, useEffect, useMemo } from 'react';

import type { AdminPlanOption } from './types';

type EntitlementFormValues = {
  entitlements: PlatformPluginPlanEntitlement[];
};

type EntitlementEditorProps = {
  entitlements?: PlatformPluginPlanEntitlement[];
  onSubmit: (entitlements: PlatformPluginPlanEntitlement[]) => Promise<void>;
  plans?: AdminPlanOption[];
  submitting?: boolean;
};

const DEFAULT_PLAN_OPTIONS = ['free', 'pro', 'team'].map((plan) => ({ label: plan, value: plan }));

const normalizeEntitlement = (
  entitlement: Partial<PlatformPluginPlanEntitlement>,
): PlatformPluginPlanEntitlement => ({
  discountPercent: Number(entitlement.discountPercent ?? 0),
  freeQuotaCredits: Number(entitlement.freeQuotaCredits ?? 0),
  installable: entitlement.installable === true,
  plan: String(entitlement.plan ?? '').trim(),
  runnable: entitlement.runnable === true,
  visible: entitlement.visible === true,
});

const EntitlementEditor = memo<EntitlementEditorProps>(
  ({ entitlements = [], onSubmit, plans = [], submitting }) => {
    const [form] = Form.useForm<EntitlementFormValues>();

    const planOptions = useMemo(() => {
      const merged = new Map(DEFAULT_PLAN_OPTIONS.map((item) => [item.value, item]));

      for (const plan of plans) {
        if (!plan.plan) continue;
        merged.set(plan.plan, {
          label: plan.displayName ? `${plan.displayName} (${plan.plan})` : plan.plan,
          value: plan.plan,
        });
      }

      return Array.from(merged.values());
    }, [plans]);

    useEffect(() => {
      form.setFieldsValue({
        entitlements:
          entitlements.length > 0
            ? entitlements.map(normalizeEntitlement)
            : [{ discountPercent: 0, freeQuotaCredits: 0, installable: false, plan: 'free', runnable: false, visible: true }],
      });
    }, [entitlements, form]);

    const handleSave = async () => {
      const values = await form.validateFields();
      await onSubmit(
        (values.entitlements ?? [])
          .map(normalizeEntitlement)
          .filter((entitlement) => entitlement.plan.length > 0),
      );
    };

    return (
      <Form form={form} layout="vertical">
        <Form.List name="entitlements">
          {(fields, { add, remove }) => (
            <Flexbox gap={12}>
              {fields.length === 0 ? <Empty description="暂无套餐权限" /> : null}
              {fields.map((field) => (
                <Flexbox
                  horizontal
                  align="center"
                  gap={12}
                  key={field.key}
                  style={{ flexWrap: 'wrap' }}
                >
                  <Form.Item
                    label="套餐"
                    name={[field.name, 'plan']}
                    rules={[{ required: true }]}
                    style={{ minWidth: 180 }}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      options={planOptions}
                      placeholder="选择套餐"
                    />
                  </Form.Item>
                  <Form.Item label="可见" name={[field.name, 'visible']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="可安装" name={[field.name, 'installable']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="可运行" name={[field.name, 'runnable']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="免费额度" name={[field.name, 'freeQuotaCredits']} style={{ width: 120 }}>
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="折扣 %" name={[field.name, 'discountPercent']} style={{ width: 120 }}>
                    <InputNumber max={100} min={0} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Button danger onClick={() => remove(field.name)}>
                    删除
                  </Button>
                </Flexbox>
              ))}
              <Flexbox horizontal gap={8}>
                <Button
                  onClick={() =>
                    add({
                      discountPercent: 0,
                      freeQuotaCredits: 0,
                      installable: false,
                      plan: '',
                      runnable: false,
                      visible: true,
                    })
                  }
                >
                  添加套餐权限
                </Button>
                <Button loading={submitting} type="primary" onClick={handleSave}>
                  保存套餐权限
                </Button>
              </Flexbox>
            </Flexbox>
          )}
        </Form.List>
      </Form>
    );
  },
);

EntitlementEditor.displayName = 'EntitlementEditor';

export default EntitlementEditor;
