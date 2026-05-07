'use client';

import { Plans } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import {
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Radio,
  Select,
  Switch,
  Tabs,
  Tag,
} from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type PlanModelRule = {
  allowlist?: string[];
  blocklist?: string[];
  mode: 'allowlist' | 'blocklist';
};

type ModelType =
  | 'chat'
  | 'embedding'
  | 'tts'
  | 'stt'
  | 'image'
  | 'video'
  | 'text2music'
  | 'realtime';

type PlanModelRules = Partial<Record<ModelType, PlanModelRule>>;

type PlanRow = {
  currency: string;
  displayName: string;
  features: string[] | null;
  isActive: boolean;
  modelRules: PlanModelRules | null;
  monthlyCredits: number;
  monthlyPrice: number;
  plan: string;
  sortOrder: number;
  yearlyPrice: number;
};

const MODEL_TYPES = [
  'chat',
  'embedding',
  'tts',
  'stt',
  'image',
  'video',
  'text2music',
  'realtime',
] as const;

const SWR_KEY = ['admin-plans'];
const PLAN_OPTIONS = Object.values(Plans).map((plan) => ({
  label: plan,
  value: plan,
}));

const splitList = (value: string) =>
  value
    .split(/[\r\n,;；，]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const ModelRulesDrawer = memo<{
  onClose: () => void;
  plan: PlanRow | null;
}>(({ onClose, plan }) => {
  const { t } = useTranslation('subscription');
  const [rules, setRules] = useState<PlanModelRules>(plan?.modelRules ?? {});
  const [activeType, setActiveType] = useState<ModelType>('chat');
  const [saving, setSaving] = useState(false);

  const currentRule = rules[activeType];

  const handleSave = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const cleaned: PlanModelRules = {};
      for (const [type, rule] of Object.entries(rules)) {
        if (rule) cleaned[type as ModelType] = rule;
      }
      await adminCommercialService.setPlanModelRules({
        modelRules: Object.keys(cleaned).length > 0 ? cleaned : undefined,
        plan: plan.plan,
      });
      message.success(t('admin.plans.modelRulesSaveSuccess', '套餐模型权限已保存'));
      await mutate(SWR_KEY);
      onClose();
    } catch {
      message.error(t('admin.plans.modelRulesSaveFailed', '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (patch: Partial<PlanModelRule>) => {
    setRules((prev) => ({
      ...prev,
      [activeType]: {
        allowlist: patch.allowlist ?? prev[activeType]?.allowlist,
        blocklist: patch.blocklist ?? prev[activeType]?.blocklist,
        mode: patch.mode ?? prev[activeType]?.mode ?? 'blocklist',
      },
    }));
  };

  const removeRule = () => {
    setRules((prev) => {
      const next = { ...prev };
      delete next[activeType];
      return next;
    });
  };

  const tabs = useMemo(
    () =>
      MODEL_TYPES.map((type) => {
        const hasRule = !!rules[type];
        return {
          key: type,
          label: (
            <span>
              {t(`admin.plans.modelType.${type}`, type)}
              {hasRule && (
                <Tag color="blue" style={{ fontSize: 10, marginLeft: 4 }}>
                  已配置
                </Tag>
              )}
            </span>
          ),
        };
      }),
    [rules, t],
  );

  return (
    <Drawer
      destroyOnClose
      open={!!plan}
      width={560}
      extra={
        <Button loading={saving} type="primary" onClick={handleSave}>
          {t('admin.plans.modelRulesSave', '保存')}
        </Button>
      }
      title={t('admin.plans.modelRulesTitle', '套餐模型权限 - {{name}}', {
        name: plan?.displayName ?? plan?.plan ?? '',
      })}
      onClose={onClose}
    >
      <Tabs
        activeKey={activeType}
        items={tabs}
        onChange={(key) => setActiveType(key as ModelType)}
      />
      {currentRule ? (
        <Flexbox gap={16}>
          <Radio.Group
            value={currentRule.mode}
            onChange={(e) => updateRule({ mode: e.target.value })}
          >
            <Radio value="allowlist">
              {t('admin.plans.modelRulesModeAllowlist', '仅允许列表中的模型')}
            </Radio>
            <Radio value="blocklist">
              {t('admin.plans.modelRulesModeBlocklist', '禁用列表中的模型')}
            </Radio>
          </Radio.Group>
          {currentRule.mode === 'allowlist' ? (
            <Form.Item
              label={t('admin.plans.modelRulesAllowlist', '允许列表')}
              extra={t(
                'admin.plans.modelRulesListHint',
                '每行一个模型 ID，支持 gpt-* 这类通配符。',
              )}
            >
              <Input.TextArea
                rows={6}
                value={(currentRule.allowlist ?? []).join('\n')}
                onChange={(e) => updateRule({ allowlist: splitList(e.target.value) })}
              />
            </Form.Item>
          ) : (
            <Form.Item
              label={t('admin.plans.modelRulesBlocklist', '禁用列表')}
              extra={t(
                'admin.plans.modelRulesListHint',
                '每行一个模型 ID，支持 gpt-* 这类通配符。',
              )}
            >
              <Input.TextArea
                rows={6}
                value={(currentRule.blocklist ?? []).join('\n')}
                onChange={(e) => updateRule({ blocklist: splitList(e.target.value) })}
              />
            </Form.Item>
          )}
          <Button danger size="small" onClick={removeRule}>
            {t('admin.plans.modelRulesRemove', '移除此类型规则')}
          </Button>
        </Flexbox>
      ) : (
        <Empty
          description={t('admin.plans.modelRulesEmpty', '此类型未设置权限规则，默认允许所有模型')}
        >
          <Button
            onClick={() =>
              setRules((prev) => ({
                ...prev,
                [activeType]: { blocklist: [], mode: 'blocklist' },
              }))
            }
          >
            {t('admin.plans.modelRulesAdd', '添加权限规则')}
          </Button>
        </Empty>
      )}
    </Drawer>
  );
});
ModelRulesDrawer.displayName = 'ModelRulesDrawer';

const AdminPlansPage = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useClientDataSWR(SWR_KEY, () => adminCommercialService.listPlans());
  const [editing, setEditing] = useState<Partial<PlanRow> | null>(null);
  const [rulesPlan, setRulesPlan] = useState<PlanRow | null>(null);
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
      title: t('admin.plans.confirmDelete', '确认删除套餐？'),
      onOk: async () => {
        await adminCommercialService.deletePlan(plan);
        message.success(t('admin.plans.deleted', '套餐已删除'));
        await mutate(SWR_KEY);
      },
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
      render: (v: number, r: PlanRow) => `${v} ${r.currency}`,
      title: t('admin.plans.col.monthly', '月付'),
    },
    {
      dataIndex: 'yearlyPrice',
      key: 'yearlyPrice',
      render: (v: number, r: PlanRow) => `${v} ${r.currency}`,
      title: t('admin.plans.col.yearly', '年付'),
    },
    {
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: boolean) => (v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
      title: t('admin.plans.col.active', '状态'),
    },
    {
      key: 'actions',
      render: (_: unknown, row: PlanRow) => (
        <Flexbox horizontal gap={8}>
          <Button size="small" onClick={() => setRulesPlan(row)}>
            {t('admin.plans.modelRules', '模型权限')}
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
            label={t('admin.plans.field.key', '套餐键名（如 starter）')}
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

      <ModelRulesDrawer plan={rulesPlan} onClose={() => setRulesPlan(null)} />
    </Flexbox>
  );
});

AdminPlansPage.displayName = 'AdminPlansPage';

export default AdminPlansPage;
