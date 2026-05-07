'use client';

import { Plans } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Switch,
  Tag,
} from 'antd';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import InlineTable from '@/components/InlineTable';
import {
  ADMIN_PLAN_MODEL_MATRIX_PATH,
  type AdminPlanModelRules,
  getPlanModelRulesSummary,
} from '@/features/Admin/adminPlanModelRules';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type PlanRow = {
  currency: string;
  displayName: string;
  features: string[] | null;
  isActive: boolean;
  modelRules: AdminPlanModelRules | null;
  monthlyCredits: number;
  monthlyPrice: number;
  metadata?: {
    purchaseUrl?: string;
  } | null;
  plan: string;
  sortOrder: number;
  yearlyPrice: number;
};

type PlanFormValues = {
  currency?: string;
  displayName: string;
  features?: string;
  isActive?: boolean;
  monthlyCredits?: number;
  monthlyPrice?: number;
  plan: Plans;
  purchaseUrl?: string;
  sortOrder?: number;
  yearlyPrice?: number;
};

const SWR_KEY = ['admin-plans'];
const PLAN_OPTIONS = Object.values(Plans).map((plan) => ({
  label: plan,
  value: plan,
}));

const AdminPlansPage = memo(() => {
  const { t } = useTranslation('subscription');
  const navigate = useNavigate();
  const { data, isLoading } = useClientDataSWR(SWR_KEY, () => adminCommercialService.listPlans());
  const [editing, setEditing] = useState<Partial<PlanRow> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<PlanFormValues>();

  const items = (data?.items ?? []) as PlanRow[];

  const openEdit = (row?: PlanRow) => {
    const init = row ?? {
      currency: 'USD',
      displayName: '',
      features: [],
      isActive: true,
      monthlyCredits: 0,
      monthlyPrice: 0,
      metadata: {},
      plan: '',
      sortOrder: 0,
      yearlyPrice: 0,
    };

    setEditing(init);
    const metadata = init.metadata as PlanRow['metadata'];

    form.setFieldsValue({
      ...init,
      features: (init.features ?? []).join('\n'),
      purchaseUrl: metadata?.purchaseUrl ?? '',
    } as PlanFormValues);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const features = String(values.features || '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);

      await adminCommercialService.upsertPlan({
        currency: values.currency || 'USD',
        displayName: values.displayName,
        features,
        isActive: !!values.isActive,
        monthlyCredits: Number(values.monthlyCredits || 0),
        monthlyPrice: Number(values.monthlyPrice || 0),
        plan: values.plan,
        purchaseUrl: values.purchaseUrl?.trim() || undefined,
        sortOrder: Number(values.sortOrder || 0),
        yearlyPrice: Number(values.yearlyPrice || 0),
      });
      message.success(t('admin.plans.saveSuccess', '套餐已保存'));
      setEditing(null);
      await mutate(SWR_KEY);
    } catch {
      message.error(t('admin.plans.saveFailed', '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (plan: string) => {
    Modal.confirm({
      content: plan,
      onOk: async () => {
        await adminCommercialService.deletePlan(plan);
        message.success(t('admin.plans.deleted', '套餐已删除'));
        await mutate(SWR_KEY);
      },
      title: t('admin.plans.confirmDelete', '确认删除套餐？'),
    });
  };

  const handleToggleActive = async (row: PlanRow) => {
    await adminCommercialService.setPlanActive({ isActive: !row.isActive, plan: row.plan });
    await mutate(SWR_KEY);
  };

  const columns = [
    { dataIndex: 'plan', key: 'plan', title: t('admin.plans.col.key', '键名') },
    { dataIndex: 'displayName', key: 'displayName', title: t('admin.plans.col.name', '显示名称') },
    {
      dataIndex: 'monthlyCredits',
      key: 'monthlyCredits',
      title: t('admin.plans.col.monthlyCredits', '每月积分'),
    },
    {
      dataIndex: 'monthlyPrice',
      key: 'monthlyPrice',
      render: (value: number, row: PlanRow) => `${value} ${row.currency}`,
      title: t('admin.plans.col.monthly', '月付'),
    },
    {
      dataIndex: 'yearlyPrice',
      key: 'yearlyPrice',
      render: (value: number, row: PlanRow) => `${value} ${row.currency}`,
      title: t('admin.plans.col.yearly', '年付'),
    },
    {
      dataIndex: 'metadata',
      key: 'purchaseUrl',
      render: (metadata: PlanRow['metadata']) =>
        metadata?.purchaseUrl ? <Tag color="blue">已设置</Tag> : <Tag>未设置</Tag>,
      title: t('admin.plans.col.purchaseUrl', '购买链接'),
    },
    {
      dataIndex: 'isActive',
      key: 'isActive',
      render: (value: boolean) => (value ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
      title: t('admin.plans.col.active', '状态'),
    },
    {
      dataIndex: 'modelRules',
      key: 'modelRules',
      render: (rules: AdminPlanModelRules | null) => getPlanModelRulesSummary(rules),
      title: t('admin.plans.col.modelRules', '模型权限'),
    },
    {
      key: 'actions',
      render: (_: unknown, row: PlanRow) => (
        <Flexbox horizontal gap={8}>
          <Button size="small" onClick={() => navigate(ADMIN_PLAN_MODEL_MATRIX_PATH)}>
            {t('admin.plans.modelRules', '去矩阵配置')}
          </Button>
          <Button size="small" onClick={() => openEdit(row)}>
            {t('admin.plans.edit', '编辑')}
          </Button>
          <Button size="small" onClick={() => handleToggleActive(row)}>
            {row.isActive ? t('admin.plans.deactivate', '停用') : t('admin.plans.activate', '启用')}
          </Button>
          <Button danger size="small" onClick={() => handleDelete(row.plan)}>
            {t('admin.plans.delete', '删除')}
          </Button>
        </Flexbox>
      ),
      title: t('admin.plans.col.actions', '操作'),
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Alert
        showIcon
        type="info"
        action={
          <Button size="small" onClick={() => navigate(ADMIN_PLAN_MODEL_MATRIX_PATH)}>
            打开矩阵
          </Button>
        }
        message={t(
          'admin.plans.modelRulesMoved',
          '套餐模型权限已统一移动到“模型与计费矩阵”。此页只维护套餐价格、积分和权益，避免同一权限在多个入口重复编辑。',
        )}
      />

      <Flexbox horizontal>
        <Button type="primary" onClick={() => openEdit()}>
          {t('admin.plans.create', '新建套餐')}
        </Button>
      </Flexbox>
      {!isLoading && items.length === 0 ? (
        <Empty description={t('admin.plans.empty', '暂无套餐配置')} />
      ) : (
        <InlineTable
          columns={columns as any}
          dataSource={items}
          loading={isLoading}
          rowKey="plan"
        />
      )}

      <Modal
        confirmLoading={submitting}
        open={!!editing}
        width={600}
        title={
          editing?.plan
            ? t('admin.plans.modal.edit', '编辑套餐')
            : t('admin.plans.modal.create', '新建套餐')
        }
        onCancel={() => setEditing(null)}
        onOk={handleSave}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('admin.plans.field.key', '套餐键名')}
            name="plan"
            rules={[{ required: true }]}
          >
            <Select
              disabled={!!editing?.plan}
              options={PLAN_OPTIONS}
              placeholder={t('admin.plans.field.keyPlaceholder', '请选择一个内置支持的套餐键名')}
            />
          </Form.Item>
          <Form.Item
            label={t('admin.plans.field.name', '显示名称')}
            name="displayName"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Flexbox horizontal gap={12}>
            <Form.Item
              label={t('admin.plans.field.monthlyCredits', '每月积分')}
              name="monthlyCredits"
              style={{ flex: 1 }}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.plans.field.currency', '币种')}
              name="currency"
              style={{ width: 120 }}
            >
              <Input />
            </Form.Item>
          </Flexbox>
          <Flexbox horizontal gap={12}>
            <Form.Item
              label={t('admin.plans.field.monthly', '月付价格')}
              name="monthlyPrice"
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.plans.field.yearly', '年付价格')}
              name="yearlyPrice"
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
          </Flexbox>
          <Form.Item
            extra={t('admin.plans.field.featuresHint', '每行一条')}
            label={t('admin.plans.field.features', '权益说明')}
            name="features"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item
            label={t('admin.plans.field.purchaseUrl', '购买链接')}
            name="purchaseUrl"
            extra={t(
              'admin.plans.field.purchaseUrlHint',
              '用户在套餐页点击“升级”时会打开该链接，仅支持 http/https。',
            )}
          >
            <Input placeholder="https://..." />
          </Form.Item>
          <Flexbox horizontal gap={12}>
            <Form.Item
              label={t('admin.plans.field.sortOrder', '排序值')}
              name="sortOrder"
              style={{ flex: 1 }}
            >
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.plans.field.active', '启用')}
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
