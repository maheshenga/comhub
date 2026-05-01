'use client';

import { Button, Empty, Form, Input, InputNumber, Modal, Switch, Tag, message } from 'antd';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from '@lobehub/ui';

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
      message.success(t('admin.topup.saveSuccess', 'Package saved'));
      setEditing(null);
      await mutate(SWR_KEY);
    } catch {
      message.error(t('admin.topup.saveFailed', 'Save failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      content: id,
      onOk: async () => {
        await adminCommercialService.deletePackage(id);
        message.success(t('admin.topup.deleted', 'Package deleted'));
        await mutate(SWR_KEY);
      },
      title: t('admin.topup.confirmDelete', 'Delete package?'),
    });
  };

  const handleToggleActive = async (row: PackageRow) => {
    await adminCommercialService.setPackageActive({ id: row.id, isActive: !row.isActive });
    await mutate(SWR_KEY);
  };

  const columns = [
    { dataIndex: 'id', key: 'id', title: t('admin.topup.col.id', 'ID') },
    { dataIndex: 'displayName', key: 'displayName', title: t('admin.topup.col.name', 'Name') },
    { dataIndex: 'credits', key: 'credits', title: t('admin.topup.col.credits', 'Credits') },
    {
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number, r: PackageRow) => `${v} ${r.currency}`,
      title: t('admin.topup.col.amount', 'Amount'),
    },
    {
      dataIndex: 'validityMonths',
      key: 'validityMonths',
      title: t('admin.topup.col.validity', 'Validity (months)'),
    },
    {
      dataIndex: 'recommended',
      key: 'recommended',
      render: (v: boolean) => (v ? <Tag color="gold">Recommended</Tag> : '—'),
      title: t('admin.topup.col.recommended', 'Recommended'),
    },
    {
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: boolean) => (v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>),
      title: t('admin.topup.col.active', 'Active'),
    },
    {
      key: 'actions',
      render: (_: unknown, row: PackageRow) => (
        <Flexbox gap={8} horizontal>
          <Button size="small" onClick={() => openEdit(row)}>
            {t('admin.topup.edit', 'Edit')}
          </Button>
          <Button size="small" onClick={() => handleToggleActive(row)}>
            {row.isActive
              ? t('admin.topup.deactivate', 'Deactivate')
              : t('admin.topup.activate', 'Activate')}
          </Button>
          <Button danger size="small" onClick={() => handleDelete(row.id)}>
            {t('admin.topup.delete', 'Delete')}
          </Button>
        </Flexbox>
      ),
      title: t('admin.topup.col.actions', 'Actions'),
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox horizontal>
        <Button type="primary" onClick={() => openEdit()}>
          {t('admin.topup.create', 'Create Package')}
        </Button>
      </Flexbox>
      {!isLoading && items.length === 0 ? (
        <Empty description={t('admin.topup.empty', 'No packages configured')} />
      ) : (
        <InlineTable columns={columns as any} dataSource={items} loading={isLoading} rowKey="id" />
      )}

      <Modal
        confirmLoading={submitting}
        onCancel={() => setEditing(null)}
        onOk={handleSave}
        open={!!editing}
        title={
          editing?.id
            ? t('admin.topup.modal.edit', 'Edit Package')
            : t('admin.topup.modal.create', 'Create Package')
        }
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('admin.topup.field.id', 'Package ID (e.g. starter-100)')}
            name="id"
            rules={[{ required: true }]}
          >
            <Input disabled={!!editing?.id} />
          </Form.Item>
          <Form.Item
            label={t('admin.topup.field.name', 'Display Name')}
            name="displayName"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Flexbox gap={12} horizontal>
            <Form.Item
              label={t('admin.topup.field.credits', 'Credits')}
              name="credits"
              style={{ flex: 1 }}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.topup.field.amount', 'Amount')}
              name="amount"
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.topup.field.currency', 'Currency')}
              name="currency"
              style={{ width: 100 }}
            >
              <Input />
            </Form.Item>
          </Flexbox>
          <Flexbox gap={12} horizontal>
            <Form.Item
              label={t('admin.topup.field.validity', 'Validity (months)')}
              name="validityMonths"
              style={{ flex: 1 }}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.topup.field.sortOrder', 'Sort Order')}
              name="sortOrder"
              style={{ flex: 1 }}
            >
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Flexbox>
          <Flexbox gap={24} horizontal>
            <Form.Item
              label={t('admin.topup.field.recommended', 'Recommended')}
              name="recommended"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('admin.topup.field.active', 'Active')}
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
