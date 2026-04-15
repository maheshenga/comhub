'use client';

import { Button, Flexbox, Input } from '@lobehub/ui';
import {
  App,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input as AntdInput,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { DownloadIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lambdaClient } from '@/libs/trpc/client';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

// ============ Types ============
interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  creditsPerMonth: number;
  features: Record<string, any>;
  sort: number | null;
  enabled: boolean;
}

interface RedeemCodeRow {
  id: string;
  code: string;
  creditsAmount: number;
  planId: string | null;
  planDurationDays: number | null;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
}

// ============ Stats Tab (O1) ============
const StatsTab = memo(() => {
  const { t } = useTranslation('setting');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    lambdaClient.vip.adminGetStats
      .query()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Spin spinning={loading}>
      <Typography.Title level={5}>{t('adminVip.stats.title')}</Typography.Title>
      {stats && (
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card size="small">
              <Statistic title={t('adminVip.stats.activeSubscriptions')} value={stats.activeSubscriptions} />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title={t('adminVip.stats.expiringSoon')}
                value={stats.expiringSoon7d}
                valueStyle={stats.expiringSoon7d > 0 ? { color: '#ff4d4f' } : undefined}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic title={t('adminVip.stats.totalBalance')} value={stats.totalCreditsBalance} />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Statistic
                title={t('adminVip.stats.monthlyGranted')}
                value={stats.monthlyCreditsGranted}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Statistic
                title={t('adminVip.stats.monthlyConsumed')}
                value={stats.monthlyCreditsConsumed}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      )}
    </Spin>
  );
});

// ============ Plans Tab ============
const PlansTab = memo(() => {
  const { t } = useTranslation('setting');
  const { message } = App.useApp();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await lambdaClient.vip.adminGetAllPlans.query();
      setPlans(data as PlanRow[]);
    } catch {
      message.error(t('adminVip.loadError'));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const openCreateModal = () => {
    setEditingPlan(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true, sort: 0, priceMonthly: 0, priceYearly: 0, creditsPerMonth: 0 });
    setModalOpen(true);
  };

  const openEditModal = (plan: PlanRow) => {
    setEditingPlan(plan);
    form.setFieldsValue({ ...plan, features: JSON.stringify(plan.features || {}, null, 2) });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      let features = {};
      try { features = values.features ? JSON.parse(values.features) : {}; } catch {}

      if (editingPlan) {
        await lambdaClient.vip.adminUpdatePlan.mutate({ id: editingPlan.id, name: values.name, description: values.description || null, priceMonthly: values.priceMonthly, priceYearly: values.priceYearly, creditsPerMonth: values.creditsPerMonth, features, sort: values.sort, enabled: values.enabled });
        message.success(t('adminVip.plans.updateSuccess'));
      } else {
        await lambdaClient.vip.adminCreatePlan.mutate({ id: values.id, name: values.name, description: values.description || undefined, priceMonthly: values.priceMonthly, priceYearly: values.priceYearly, creditsPerMonth: values.creditsPerMonth, features, sort: values.sort, enabled: values.enabled });
        message.success(t('adminVip.plans.createSuccess'));
      }
      setModalOpen(false);
      fetchPlans();
    } catch { message.error(t('adminVip.operationError')); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await lambdaClient.vip.adminDeletePlan.mutate({ id }); message.success(t('adminVip.plans.deleteSuccess')); fetchPlans(); } catch { message.error(t('adminVip.operationError')); }
  };

  const columns = [
    { dataIndex: 'id', key: 'id', title: t('adminVip.plans.id'), width: 120 },
    { dataIndex: 'name', key: 'name', title: t('adminVip.plans.name'), width: 150 },
    { dataIndex: 'priceMonthly', key: 'priceMonthly', title: t('adminVip.plans.priceMonthly'), width: 100 },
    { dataIndex: 'priceYearly', key: 'priceYearly', title: t('adminVip.plans.priceYearly'), width: 100 },
    { dataIndex: 'creditsPerMonth', key: 'creditsPerMonth', title: t('adminVip.plans.creditsPerMonth'), width: 120 },
    { dataIndex: 'enabled', key: 'enabled', render: (v: boolean) => (v ? 'Yes' : 'No'), title: t('adminVip.plans.enabled'), width: 80 },
    { key: 'actions', render: (_: any, record: PlanRow) => (
        <Space>
          <Button onClick={() => openEditModal(record)} size={'small'} type={'text'}>{t('adminVip.plans.edit')}</Button>
          <Popconfirm onConfirm={() => handleDelete(record.id)} title={t('adminVip.plans.deleteConfirm')}>
            <Button danger size={'small'} type={'text'}>{t('adminVip.plans.delete')}</Button>
          </Popconfirm>
        </Space>
      ), title: '', width: 150 },
  ];

  return (
    <>
      <Flexbox align={'center'} horizontal justify={'space-between'} style={{ marginBottom: 16 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>{t('adminVip.plans.title')}</Typography.Title>
        <Button icon={PlusIcon} onClick={openCreateModal} type={'primary'}>{t('adminVip.plans.create')}</Button>
      </Flexbox>
      <Spin spinning={loading}><Table columns={columns} dataSource={plans} pagination={false} rowKey="id" size="small" /></Spin>
      <Modal confirmLoading={saving} onCancel={() => setModalOpen(false)} onOk={handleSave} open={modalOpen} title={editingPlan ? t('adminVip.plans.edit') : t('adminVip.plans.create')}>
        <Form form={form} layout="vertical">
          {!editingPlan && <Form.Item label={t('adminVip.plans.id')} name="id" rules={[{ required: true }]}><Input placeholder="e.g. basic, pro" /></Form.Item>}
          <Form.Item label={t('adminVip.plans.name')} name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label={t('adminVip.plans.description')} name="description"><AntdInput.TextArea autoSize={{ maxRows: 3, minRows: 1 }} /></Form.Item>
          <Space size="middle">
            <Form.Item label={t('adminVip.plans.priceMonthly')} name="priceMonthly"><InputNumber min={0} /></Form.Item>
            <Form.Item label={t('adminVip.plans.priceYearly')} name="priceYearly"><InputNumber min={0} /></Form.Item>
            <Form.Item label={t('adminVip.plans.creditsPerMonth')} name="creditsPerMonth"><InputNumber min={0} /></Form.Item>
          </Space>
          <Space size="middle">
            <Form.Item label={t('adminVip.plans.sort')} name="sort"><InputNumber /></Form.Item>
            <Form.Item label={t('adminVip.plans.enabled')} name="enabled" valuePropName="checked"><Switch /></Form.Item>
          </Space>
          <Form.Item label={t('adminVip.plans.features')} name="features"><AntdInput.TextArea autoSize={{ maxRows: 6, minRows: 2 }} placeholder="{}" /></Form.Item>
        </Form>
      </Modal>
    </>
  );
});

// ============ Redeem Codes Tab ============
const RedeemCodesTab = memo(() => {
  const { t } = useTranslation('setting');
  const { message } = App.useApp();
  const [codes, setCodes] = useState<RedeemCodeRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [codesData, plansData] = await Promise.all([
        lambdaClient.vip.adminGetRedeemCodes.query(),
        lambdaClient.vip.adminGetAllPlans.query(),
      ]);
      setCodes(codesData as RedeemCodeRow[]);
      setPlans(plansData as PlanRow[]);
    } catch { message.error(t('adminVip.loadError')); } finally { setLoading(false); }
  }, [message, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      await lambdaClient.vip.adminCreateRedeemCode.mutate({ code: values.code, creditsAmount: values.creditsAmount || 0, planId: values.planId || null, planDurationDays: values.planDurationDays || null, maxUses: values.maxUses || 1, expiresAt: values.expiresAt?.toDate() || null });
      message.success(t('adminVip.redeem.createSuccess'));
      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch { message.error(t('adminVip.operationError')); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await lambdaClient.vip.adminDeleteRedeemCode.mutate({ id }); message.success(t('adminVip.redeem.deleteSuccess')); fetchData(); } catch { message.error(t('adminVip.operationError')); }
  };

  const columns = [
    { dataIndex: 'code', key: 'code', title: t('adminVip.redeem.code'), width: 150 },
    { dataIndex: 'creditsAmount', key: 'creditsAmount', title: t('adminVip.redeem.creditsAmount'), width: 100 },
    { dataIndex: 'planId', key: 'planId', title: t('adminVip.redeem.planId'), width: 100 },
    { dataIndex: 'planDurationDays', key: 'planDurationDays', title: t('adminVip.redeem.planDurationDays'), width: 100 },
    { key: 'usage', render: (_: any, r: RedeemCodeRow) => `${r.usedCount} / ${r.maxUses}`, title: t('adminVip.redeem.usedCount'), width: 80 },
    { dataIndex: 'expiresAt', key: 'expiresAt', render: (v: Date | null) => (v ? new Date(v).toLocaleDateString() : '-'), title: t('adminVip.redeem.expiresAt'), width: 120 },
    { key: 'actions', render: (_: any, record: RedeemCodeRow) => (
        <Popconfirm onConfirm={() => handleDelete(record.id)} title={t('adminVip.redeem.deleteConfirm')}>
          <Button danger icon={Trash2Icon} size={'small'} type={'text'} />
        </Popconfirm>
      ), title: '', width: 60 },
  ];

  return (
    <>
      <Flexbox align={'center'} horizontal justify={'space-between'} style={{ marginBottom: 16 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>{t('adminVip.redeem.title')}</Typography.Title>
        <Button icon={PlusIcon} onClick={() => { form.resetFields(); form.setFieldsValue({ maxUses: 1, creditsAmount: 0 }); setModalOpen(true); }} type={'primary'}>{t('adminVip.redeem.create')}</Button>
      </Flexbox>
      <Spin spinning={loading}><Table columns={columns} dataSource={codes} pagination={false} rowKey="id" size="small" /></Spin>
      <Modal confirmLoading={saving} onCancel={() => setModalOpen(false)} onOk={handleCreate} open={modalOpen} title={t('adminVip.redeem.create')}>
        <Form form={form} layout="vertical">
          <Form.Item label={t('adminVip.redeem.code')} name="code" rules={[{ required: true }]}><Input placeholder="e.g. VIP2024" /></Form.Item>
          <Space size="middle">
            <Form.Item label={t('adminVip.redeem.creditsAmount')} name="creditsAmount"><InputNumber min={0} /></Form.Item>
            <Form.Item label={t('adminVip.redeem.maxUses')} name="maxUses"><InputNumber min={1} /></Form.Item>
          </Space>
          <Space size="middle">
            <Form.Item label={t('adminVip.redeem.planId')} name="planId">
              <Select allowClear options={plans.map((p) => ({ label: p.name, value: p.id }))} placeholder="-" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item label={t('adminVip.redeem.planDurationDays')} name="planDurationDays"><InputNumber min={1} /></Form.Item>
          </Space>
          <Form.Item label={t('adminVip.redeem.expiresAt')} name="expiresAt"><DatePicker /></Form.Item>
        </Form>
      </Modal>
    </>
  );
});

// ============ User Management Tab ============
const UserManagementTab = memo(() => {
  const { t } = useTranslation('setting');
  const { message } = App.useApp();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [creditForm] = Form.useForm();
  const [subForm] = Form.useForm();
  const [savingCredits, setSavingCredits] = useState(false);
  const [savingSub, setSavingSub] = useState(false);

  useEffect(() => { lambdaClient.vip.adminGetAllPlans.query().then((data) => setPlans(data as PlanRow[])); }, []);

  const handleAdjustCredits = async () => {
    setSavingCredits(true);
    try {
      const values = await creditForm.validateFields();
      await lambdaClient.vip.adminAdjustCredits.mutate({ userId: values.userId, amount: values.amount, description: values.description || undefined });
      message.success(t('adminVip.users.adjustSuccess'));
      creditForm.resetFields();
    } catch { message.error(t('adminVip.operationError')); } finally { setSavingCredits(false); }
  };

  const handleGrantSubscription = async () => {
    setSavingSub(true);
    try {
      const values = await subForm.validateFields();
      await lambdaClient.vip.adminGrantSubscription.mutate({ userId: values.userId, planId: values.planId, durationDays: values.durationDays });
      message.success(t('adminVip.users.grantSuccess'));
      subForm.resetFields();
    } catch { message.error(t('adminVip.operationError')); } finally { setSavingSub(false); }
  };

  return (
    <>
      <Typography.Title level={5}>{t('adminVip.users.adjustCredits')}</Typography.Title>
      <Form form={creditForm} layout="vertical" style={{ maxWidth: 500 }}>
        <Form.Item label={t('adminVip.users.userId')} name="userId" rules={[{ required: true }]}><Input placeholder="User ID" /></Form.Item>
        <Form.Item label={t('adminVip.users.amount')} name="amount" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
        <Form.Item label={t('adminVip.users.adjustDescription')} name="description"><AntdInput.TextArea autoSize={{ maxRows: 2, minRows: 1 }} /></Form.Item>
        <Form.Item><Button loading={savingCredits} onClick={handleAdjustCredits} type={'primary'}>{t('adminVip.users.adjustCredits')}</Button></Form.Item>
      </Form>
      <Divider />
      <Typography.Title level={5}>{t('adminVip.users.grantSubscription')}</Typography.Title>
      <Form form={subForm} layout="vertical" style={{ maxWidth: 500 }}>
        <Form.Item label={t('adminVip.users.userId')} name="userId" rules={[{ required: true }]}><Input placeholder="User ID" /></Form.Item>
        <Form.Item label={t('adminVip.users.planId')} name="planId" rules={[{ required: true }]}><Select options={plans.map((p) => ({ label: p.name, value: p.id }))} placeholder="Select a plan" /></Form.Item>
        <Form.Item label={t('adminVip.users.durationDays')} name="durationDays" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
        <Form.Item><Button loading={savingSub} onClick={handleGrantSubscription} type={'primary'}>{t('adminVip.users.grantSubscription')}</Button></Form.Item>
      </Form>
    </>
  );
});

// ============ Bulk Operations Tab (O2) ============
const BulkTab = memo(() => {
  const { t } = useTranslation('setting');
  const { message } = App.useApp();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [creditForm] = Form.useForm();
  const [subForm] = Form.useForm();
  const [savingCredits, setSavingCredits] = useState(false);
  const [savingSub, setSavingSub] = useState(false);

  useEffect(() => { lambdaClient.vip.adminGetAllPlans.query().then((data) => setPlans(data as PlanRow[])); }, []);

  const parseUserIds = (text: string): string[] =>
    text.split('\n').map((s) => s.trim()).filter(Boolean);

  const handleBulkCredits = async () => {
    setSavingCredits(true);
    try {
      const values = await creditForm.validateFields();
      const userIds = parseUserIds(values.userIds);
      if (userIds.length === 0) return;
      const result = await lambdaClient.vip.adminBulkAdjustCredits.mutate({
        userIds, amount: values.amount, description: values.description || undefined,
      });
      message.success(t('adminVip.bulk.success', { success: result.successCount, total: result.totalRequested }));
      creditForm.resetFields();
    } catch { message.error(t('adminVip.operationError')); } finally { setSavingCredits(false); }
  };

  const handleBulkSub = async () => {
    setSavingSub(true);
    try {
      const values = await subForm.validateFields();
      const userIds = parseUserIds(values.userIds);
      if (userIds.length === 0) return;
      const result = await lambdaClient.vip.adminBulkGrantSubscription.mutate({
        userIds, planId: values.planId, durationDays: values.durationDays,
      });
      message.success(t('adminVip.bulk.success', { success: result.successCount, total: result.totalRequested }));
      subForm.resetFields();
    } catch { message.error(t('adminVip.operationError')); } finally { setSavingSub(false); }
  };

  return (
    <>
      <Typography.Title level={5}>{t('adminVip.bulk.adjustCredits')}</Typography.Title>
      <Form form={creditForm} layout="vertical" style={{ maxWidth: 500 }}>
        <Form.Item label={t('adminVip.bulk.userIds')} name="userIds" rules={[{ required: true }]}>
          <AntdInput.TextArea autoSize={{ maxRows: 6, minRows: 3 }} placeholder="user_id_1\nuser_id_2" />
        </Form.Item>
        <Form.Item label={t('adminVip.bulk.amount')} name="amount" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
        <Form.Item label={t('adminVip.bulk.description')} name="description"><AntdInput.TextArea autoSize={{ maxRows: 2, minRows: 1 }} /></Form.Item>
        <Form.Item><Button loading={savingCredits} onClick={handleBulkCredits} type={'primary'}>{t('adminVip.bulk.adjustCredits')}</Button></Form.Item>
      </Form>
      <Divider />
      <Typography.Title level={5}>{t('adminVip.bulk.grantSubscription')}</Typography.Title>
      <Form form={subForm} layout="vertical" style={{ maxWidth: 500 }}>
        <Form.Item label={t('adminVip.bulk.userIds')} name="userIds" rules={[{ required: true }]}>
          <AntdInput.TextArea autoSize={{ maxRows: 6, minRows: 3 }} placeholder="user_id_1\nuser_id_2" />
        </Form.Item>
        <Form.Item label={t('adminVip.bulk.planId')} name="planId" rules={[{ required: true }]}><Select options={plans.map((p) => ({ label: p.name, value: p.id }))} placeholder="Select a plan" /></Form.Item>
        <Form.Item label={t('adminVip.bulk.durationDays')} name="durationDays" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
        <Form.Item><Button loading={savingSub} onClick={handleBulkSub} type={'primary'}>{t('adminVip.bulk.grantSubscription')}</Button></Form.Item>
      </Form>
    </>
  );
});

// ============ Export Tab (O3) ============
const ExportTab = memo(() => {
  const { t } = useTranslation('setting');
  const { message } = App.useApp();
  const [userId, setUserId] = useState('');
  const [type, setType] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: any = {};
      if (userId.trim()) params.userId = userId.trim();
      if (type) params.type = type;
      const data = await lambdaClient.vip.adminExportTransactions.query(params) as any[];

      if (data.length === 0) {
        message.info('No data to export');
        return;
      }

      // Convert to CSV
      const headers = ['id', 'userId', 'amount', 'type', 'description', 'model', 'tokensInput', 'tokensOutput', 'referenceId', 'createdAt'];
      const csvRows = [headers.join(',')];
      for (const row of data) {
        csvRows.push(headers.map((h) => {
          const val = (row as any)[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(','));
      }

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `credit_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { message.error(t('adminVip.operationError')); } finally { setExporting(false); }
  };

  const typeOptions = [
    { label: 'Subscription Grant', value: 'subscription_grant' },
    { label: 'Usage Deduct', value: 'usage_deduct' },
    { label: 'Redeem', value: 'redeem' },
    { label: 'Admin Adjust', value: 'admin_adjust' },
    { label: 'Referral', value: 'referral' },
  ];

  return (
    <>
      <Typography.Title level={5}>{t('adminVip.export.title')}</Typography.Title>
      <Flexbox gap={12} style={{ maxWidth: 500 }}>
        <Input
          onChange={(e) => setUserId(e.target.value)}
          placeholder={t('adminVip.export.userId')}
          value={userId}
        />
        <Select
          allowClear
          onChange={setType}
          options={typeOptions}
          placeholder={t('adminVip.export.type')}
          value={type}
        />
        <Button icon={DownloadIcon} loading={exporting} onClick={handleExport} type={'primary'}>
          {t('adminVip.export.download')}
        </Button>
      </Flexbox>
    </>
  );
});

// ============ Audit Logs Tab (S2) ============
const AuditTab = memo(() => {
  const { t } = useTranslation('setting');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    lambdaClient.vip.adminGetAuditLogs
      .query()
      .then((data) => setLogs(data as any[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { dataIndex: 'actorId', key: 'actorId', title: t('adminVip.audit.actor'), width: 150, ellipsis: true },
    { dataIndex: 'action', key: 'action', title: t('adminVip.audit.action'), width: 160,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { key: 'target', title: t('adminVip.audit.target'), width: 200,
      render: (_: any, r: any) => r.targetType ? `${r.targetType}:${r.targetId || '-'}` : '-',
    },
    { dataIndex: 'createdAt', key: 'createdAt', title: t('adminVip.audit.time'), width: 180,
      render: (v: Date) => new Date(v).toLocaleString(),
    },
    { dataIndex: 'details', key: 'details', title: t('adminVip.audit.details'), ellipsis: true,
      render: (v: any) => v ? JSON.stringify(v).slice(0, 100) : '-',
    },
  ];

  return (
    <Spin spinning={loading}>
      <Table columns={columns} dataSource={logs} pagination={{ pageSize: 50 }} rowKey="id" size="small" />
    </Spin>
  );
});

// ============ Main Component ============
const AdminVipSettings = memo(() => {
  const { t } = useTranslation('setting');

  const items = [
    { children: <StatsTab />, key: 'stats', label: t('adminVip.stats.title') },
    { children: <PlansTab />, key: 'plans', label: t('adminVip.plans.title') },
    { children: <RedeemCodesTab />, key: 'redeem', label: t('adminVip.redeem.title') },
    { children: <UserManagementTab />, key: 'users', label: t('adminVip.users.title') },
    { children: <BulkTab />, key: 'bulk', label: t('adminVip.bulk.title') },
    { children: <ExportTab />, key: 'export', label: t('adminVip.export.title') },
    { children: <AuditTab />, key: 'audit', label: t('adminVip.audit.title') },
  ];

  return (
    <>
      <SettingHeader title={t('adminVip.title')} />
      <div style={{ paddingBlockStart: 16 }}>
        <Tabs defaultActiveKey="stats" items={items} />
      </div>
    </>
  );
});

export default AdminVipSettings;
