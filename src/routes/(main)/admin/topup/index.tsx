'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Empty, Form, Input, InputNumber, message, Modal, Switch, Tag } from 'antd';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type PackageRow = {
  amount: number;
  credits: number;
  currency: string;
  displayName: string;
  id: string;
  isActive: boolean;
  recommended: boolean;
  sortOrder: number;
  validityMonths: number;
};

const SWR_KEY = ['admin-topup-packages'];

const AdminTopUpPage = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useClientDataSWR(SWR_KEY, () =>
    adminCommercialService.listPackages(),
  );
  const [editing, setEditing] = useState<Partial<PackageRow> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const items = (data?.items ?? []) as PackageRow[];

  const openEdit = (row?: PackageRow) => {
    const init = row ?? {
      amount: 0,
      credits: 0,
      currency: 'USD',
      displayName: '',
      id: '',
      isActive: true,
      recommended: false,
      sortOrder: 0,
      validityMonths: 12,
    };
    setEditing(init);
    form.setFieldsValue(init);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await adminCommercialService.upsertPackage({
        amount: Number(values.amount || 0),
        credits: Number(values.credits || 0),
        currency: values.currency || 'USD',
        displayName: values.displayName,
        id: values.id,
        isActive: !!values.isActive,
        recommended: !!values.recommended,
        sortOrder: Number(values.sortOrder || 0),
        validityMonths: Number(values.validityMonths || 12),
      });
      message.success(t('admin.topup.saveSuccess', '充值套餐已保存'));
      setEditing(null);
      await mutate(SWR_KEY);
    } catch {
      message.error(t('admin.topup.saveFailed', '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      content: id,
      onOk: async () => {
        await adminCommercialService.deletePackage(id);
        message.success(t('admin.topup.deleted', '充值套餐已删除'));
        await mutate(SWR_KEY);
      },
      title: t('admin.topup.confirmDelete', '确认删除这个充值套餐？'),
    });
  };

  const handleToggleActive = async (row: PackageRow) => {
    await adminCommercialService.setPackageActive({ id: row.id, isActive: !row.isActive });
    await mutate(SWR_KEY);
  };

  const columns = [
    { dataIndex: 'id', key: 'id', title: t('admin.topup.col.id', 'ID') },
    { dataIndex: 'displayName', key: 'displayName', title: t('admin.topup.col.name', '套餐名称') },
    { dataIndex: 'credits', key: 'credits', title: t('admin.topup.col.credits', '积分') },
    {
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number, r: PackageRow) => `${v} ${r.currency}`,
      title: t('admin.topup.col.amount', '金额'),
    },
    {
      dataIndex: 'validityMonths',
      key: 'validityMonths',
      title: t('admin.topup.col.validity', '有效期（月）'),
    },
    {
      dataIndex: 'recommended',
      key: 'recommended',
      render: (v: boolean) => (v ? <Tag color="gold">推荐</Tag> : '-'),
      title: t('admin.topup.col.recommended', '推荐'),
    },
    {
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: boolean) => (v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
      title: t('admin.topup.col.active', '状态'),
    },
    {
      key: 'actions',
      render: (_: unknown, row: PackageRow) => (
        <Flexbox horizontal gap={8}>
          <Button size="small" onClick={() => openEdit(row)}>
            {t('admin.topup.edit', '编辑')}
          </Button>
          <Button size="small" onClick={() => handleToggleActive(row)}>
            {row.isActive ? t('admin.topup.deactivate', '停用') : t('admin.topup.activate', '启用')}
          </Button>
          <Button danger size="small" onClick={() => handleDelete(row.id)}>
            {t('admin.topup.delete', '删除')}
          </Button>
        </Flexbox>
      ),
      title: t('admin.topup.col.actions', '操作'),
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox horizontal>
        <Button type="primary" onClick={() => openEdit()}>
          {t('admin.topup.create', '新增充值套餐')}
        </Button>
      </Flexbox>
      {!isLoading && items.length === 0 ? (
        <Empty description={t('admin.topup.empty', '暂无充值套餐')} />
      ) : (
        <InlineTable columns={columns as any} dataSource={items} loading={isLoading} rowKey="id" />
      )}

      <Modal
        confirmLoading={submitting}
        open={!!editing}
        width={600}
        title={
          editing?.id
            ? t('admin.topup.modal.edit', '编辑充值套餐')
            : t('admin.topup.modal.create', '新增充值套餐')
        }
        onCancel={() => setEditing(null)}
        onOk={handleSave}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('admin.topup.field.id', '套餐 ID（如 starter-100）')}
            name="id"
            rules={[{ required: true }]}
          >
            <Input disabled={!!editing?.id} />
          </Form.Item>
          <Form.Item
            label={t('admin.topup.field.name', '套餐名称')}
            name="displayName"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Flexbox horizontal gap={12}>
            <Form.Item
              label={t('admin.topup.field.credits', '积分')}
              name="credits"
              style={{ flex: 1 }}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.topup.field.amount', '金额')}
              name="amount"
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.topup.field.currency', '币种')}
              name="currency"
              style={{ width: 100 }}
            >
              <Input />
            </Form.Item>
          </Flexbox>
          <Flexbox horizontal gap={12}>
            <Form.Item
              label={t('admin.topup.field.validity', '有效期（月）')}
              name="validityMonths"
              style={{ flex: 1 }}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.topup.field.sortOrder', '排序值')}
              name="sortOrder"
              style={{ flex: 1 }}
            >
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Flexbox>
          <Flexbox horizontal gap={24}>
            <Form.Item
              label={t('admin.topup.field.recommended', '推荐')}
              name="recommended"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('admin.topup.field.active', '启用')}
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

AdminTopUpPage.displayName = 'AdminTopUpPage';

export default AdminTopUpPage;
