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
      message.success(t('admin.topup.saveSuccess', '??????'));
      setEditing(null);
      await mutate(SWR_KEY);
    } catch {
      message.error(t('admin.topup.saveFailed', '????'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      content: id,
      onOk: async () => {
        await adminCommercialService.deletePackage(id);
        message.success(t('admin.topup.deleted', '??????'));
        await mutate(SWR_KEY);
      },
      title: t('admin.topup.confirmDelete', '????????'),
    });
  };

  const handleToggleActive = async (row: PackageRow) => {
    await adminCommercialService.setPackageActive({ id: row.id, isActive: !row.isActive });
    await mutate(SWR_KEY);
  };

  const columns = [
    { dataIndex: 'id', key: 'id', title: t('admin.topup.col.id', 'ID') },
    { dataIndex: 'displayName', key: 'displayName', title: t('admin.topup.col.name', '????') },
    { dataIndex: 'credits', key: 'credits', title: t('admin.topup.col.credits', '??') },
    {
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number, r: PackageRow) => `${v} ${r.currency}`,
      title: t('admin.topup.col.amount', '??'),
    },
    {
      dataIndex: 'validityMonths',
      key: 'validityMonths',
      title: t('admin.topup.col.validity', '??????'),
    },
    {
      dataIndex: 'recommended',
      key: 'recommended',
      render: (v: boolean) => (v ? <Tag color="gold">??</Tag> : '—'),
      title: t('admin.topup.col.recommended', '??'),
    },
    {
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: boolean) => (v ? <Tag color="green">??</Tag> : <Tag>??</Tag>),
      title: t('admin.topup.col.active', '??'),
    },
    {
      key: 'actions',
      render: (_: unknown, row: PackageRow) => (
        <Flexbox horizontal gap={8}>
          <Button size="small" onClick={() => openEdit(row)}>
            {t('admin.topup.edit', '??')}
          </Button>
          <Button size="small" onClick={() => handleToggleActive(row)}>
            {row.isActive ? t('admin.topup.deactivate', '??') : t('admin.topup.activate', '??')}
          </Button>
          <Button danger size="small" onClick={() => handleDelete(row.id)}>
            {t('admin.topup.delete', '??')}
          </Button>
        </Flexbox>
      ),
      title: t('admin.topup.col.actions', '??'),
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox horizontal>
        <Button type="primary" onClick={() => openEdit()}>
          {t('admin.topup.create', '?????')}
        </Button>
      </Flexbox>
      {!isLoading && items.length === 0 ? (
        <Empty description={t('admin.topup.empty', '???????')} />
      ) : (
        <InlineTable columns={columns as any} dataSource={items} loading={isLoading} rowKey="id" />
      )}

      <Modal
        confirmLoading={submitting}
        open={!!editing}
        width={600}
        title={
          editing?.id
            ? t('admin.topup.modal.edit', '?????')
            : t('admin.topup.modal.create', '?????')
        }
        onCancel={() => setEditing(null)}
        onOk={handleSave}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('admin.topup.field.id', '??? ID?? starter-100?')}
            name="id"
            rules={[{ required: true }]}
          >
            <Input disabled={!!editing?.id} />
          </Form.Item>
          <Form.Item
            label={t('admin.topup.field.name', '????')}
            name="displayName"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Flexbox horizontal gap={12}>
            <Form.Item
              label={t('admin.topup.field.credits', '??')}
              name="credits"
              style={{ flex: 1 }}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.topup.field.amount', '??')}
              name="amount"
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.topup.field.currency', '??')}
              name="currency"
              style={{ width: 100 }}
            >
              <Input />
            </Form.Item>
          </Flexbox>
          <Flexbox horizontal gap={12}>
            <Form.Item
              label={t('admin.topup.field.validity', '??????')}
              name="validityMonths"
              style={{ flex: 1 }}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.topup.field.sortOrder', '???')}
              name="sortOrder"
              style={{ flex: 1 }}
            >
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Flexbox>
          <Flexbox horizontal gap={24}>
            <Form.Item
              label={t('admin.topup.field.recommended', '??')}
              name="recommended"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('admin.topup.field.active', '??')}
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
