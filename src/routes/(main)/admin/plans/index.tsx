'use client';

import { Plans } from '@lobechat/types';
import { Button, Empty, Form, Input, InputNumber, Modal, Select, Switch, Tag, message } from 'antd';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from '@lobehub/ui';

import InlineTable from '@/components/InlineTable';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type PlanRow = {
  currency: string;
  displayName: string;
  features: string[] | null;
  isActive: boolean;
  monthlyCredits: number;
  monthlyPrice: number;
  plan: string;
  sortOrder: number;
  yearlyPrice: number;
};

const SWR_KEY = ['admin-plans'];
const PLAN_OPTIONS = Object.values(Plans).map((plan) => ({
  label: plan,
  value: plan,
}));

const AdminPlansPage = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useClientDataSWR(SWR_KEY, () =>
    adminCommercialService.listPlans(),
  );
  const [editing, setEditing] = useState<Partial<PlanRow> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const items = (data?.items ?? []) as PlanRow[];

  const openEdit = (row?: PlanRow) => {
    const init = row ?? {
      currency: 'USD',
      displayName: '',
      features: [],
      isActive: true,
      monthlyCredits: 0,
      monthlyPrice: 0,
      plan: '',
      sortOrder: 0,
      yearlyPrice: 0,
    };
    setEditing(init);
    form.setFieldsValue({
      ...init,
      features: (init.features ?? []).join('\n'),
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const features = String(values.features || '')
        .split('\n')
        .map((s: string) => s.trim())
        .filter(Boolean);
      await adminCommercialService.upsertPlan({
        currency: values.currency || 'USD',
        displayName: values.displayName,
        features,
        isActive: !!values.isActive,
        monthlyCredits: Number(values.monthlyCredits || 0),
        monthlyPrice: Number(values.monthlyPrice || 0),
        plan: values.plan,
        sortOrder: Number(values.sortOrder || 0),
        yearlyPrice: Number(values.yearlyPrice || 0),
      });
      message.success(t('admin.plans.saveSuccess', 'Plan saved'));
      setEditing(null);
      await mutate(SWR_KEY);
    } catch {
      message.error(t('admin.plans.saveFailed', 'Save failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (plan: string) => {
    Modal.confirm({
      content: plan,
      onOk: async () => {
        await adminCommercialService.deletePlan(plan);
        message.success(t('admin.plans.deleted', 'Plan deleted'));
        await mutate(SWR_KEY);
      },
      title: t('admin.plans.confirmDelete', 'Delete plan?'),
    });
  };

  const handleToggleActive = async (row: PlanRow) => {
    await adminCommercialService.setPlanActive({ isActive: !row.isActive, plan: row.plan });
    await mutate(SWR_KEY);
  };

  const columns = [
    { dataIndex: 'plan', key: 'plan', title: t('admin.plans.col.key', 'Key') },
    { dataIndex: 'displayName', key: 'displayName', title: t('admin.plans.col.name', 'Name') },
    {
      dataIndex: 'monthlyCredits',
      key: 'monthlyCredits',
      title: t('admin.plans.col.monthlyCredits', 'Monthly Credits'),
    },
    {
      dataIndex: 'monthlyPrice',
      key: 'monthlyPrice',
      render: (v: number, r: PlanRow) => `${v} ${r.currency}`,
      title: t('admin.plans.col.monthly', 'Monthly'),
    },
    {
      dataIndex: 'yearlyPrice',
      key: 'yearlyPrice',
      render: (v: number, r: PlanRow) => `${v} ${r.currency}`,
      title: t('admin.plans.col.yearly', 'Yearly'),
    },
    {
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: boolean) => (v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>),
      title: t('admin.plans.col.active', 'Active'),
    },
    {
      key: 'actions',
      render: (_: unknown, row: PlanRow) => (
        <Flexbox gap={8} horizontal>
          <Button size="small" onClick={() => openEdit(row)}>
            {t('admin.plans.edit', 'Edit')}
          </Button>
          <Button size="small" onClick={() => handleToggleActive(row)}>
            {row.isActive
              ? t('admin.plans.deactivate', 'Deactivate')
              : t('admin.plans.activate', 'Activate')}
          </Button>
          <Button danger size="small" onClick={() => handleDelete(row.plan)}>
            {t('admin.plans.delete', 'Delete')}
          </Button>
        </Flexbox>
      ),
      title: t('admin.plans.col.actions', 'Actions'),
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox horizontal>
        <Button type="primary" onClick={() => openEdit()}>
          {t('admin.plans.create', 'Create Plan')}
        </Button>
      </Flexbox>
      {!isLoading && items.length === 0 ? (
        <Empty description={t('admin.plans.empty', 'No plans configured')} />
      ) : (
        <InlineTable columns={columns as any} dataSource={items} loading={isLoading} rowKey="plan" />
      )}

      <Modal
        confirmLoading={submitting}
        onCancel={() => setEditing(null)}
        onOk={handleSave}
        open={!!editing}
        title={
          editing?.plan
            ? t('admin.plans.modal.edit', 'Edit Plan')
            : t('admin.plans.modal.create', 'Create Plan')
        }
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('admin.plans.field.key', 'Plan Key (e.g. starter)')}
            name="plan"
            rules={[{ required: true }]}
          >
            <Select
              disabled={!!editing?.plan}
              options={PLAN_OPTIONS}
              placeholder={t(
                'admin.plans.field.keyPlaceholder',
                'Select one of the supported built-in plan keys',
              )}
            />
          </Form.Item>
          <Form.Item
            label={t('admin.plans.field.name', 'Display Name')}
            name="displayName"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Flexbox gap={12} horizontal>
            <Form.Item
              label={t('admin.plans.field.monthlyCredits', 'Monthly Credits')}
              name="monthlyCredits"
              style={{ flex: 1 }}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.plans.field.currency', 'Currency')}
              name="currency"
              style={{ width: 120 }}
            >
              <Input />
            </Form.Item>
          </Flexbox>
          <Flexbox gap={12} horizontal>
            <Form.Item
              label={t('admin.plans.field.monthly', 'Monthly Price')}
              name="monthlyPrice"
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.plans.field.yearly', 'Yearly Price')}
              name="yearlyPrice"
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
          </Flexbox>
          <Form.Item
            extra={t('admin.plans.field.featuresHint', 'One per line')}
            label={t('admin.plans.field.features', 'Features')}
            name="features"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Flexbox gap={12} horizontal>
            <Form.Item
              label={t('admin.plans.field.sortOrder', 'Sort Order')}
              name="sortOrder"
              style={{ flex: 1 }}
            >
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.plans.field.active', 'Active')}
              name="isActive"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Flexbox>
        </Form>
      </Modal>
    </Flexbox>
  );
});

AdminPlansPage.displayName = 'AdminPlansPage';

export default AdminPlansPage;
