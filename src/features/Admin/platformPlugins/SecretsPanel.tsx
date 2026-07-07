'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Empty, Form, Input, Modal, Tag, Typography } from 'antd';
import { memo } from 'react';

import InlineTable from '@/components/InlineTable';

import type { AdminPlatformPluginSecret } from './types';

const { Text } = Typography;

type SecretFormValues = {
  key: string;
  scope?: string;
  value: string;
};

type SecretsPanelProps = {
  onDelete: (input: { key: string; scope?: string }) => Promise<void>;
  onUpsert: (input: SecretFormValues) => Promise<void>;
  secrets?: AdminPlatformPluginSecret[];
  submitting?: boolean;
};

const SecretsPanel = memo<SecretsPanelProps>(
  ({ onDelete, onUpsert, secrets = [], submitting }) => {
    const [form] = Form.useForm<SecretFormValues>();

    const handleSave = async () => {
      const values = await form.validateFields();
      await onUpsert({
        key: values.key.trim(),
        scope: values.scope?.trim() || 'global',
        value: values.value,
      });
      form.resetFields(['key', 'value']);
      form.setFieldValue('scope', 'global');
    };

    const handleDelete = (secret: AdminPlatformPluginSecret) => {
      Modal.confirm({
        content: `${secret.scope}/${secret.key}`,
        onOk: () => onDelete({ key: secret.key, scope: secret.scope }),
        title: '确认删除这个密钥？',
      });
    };

    const columns = [
      { dataIndex: 'scope', key: 'scope', title: '范围' },
      { dataIndex: 'key', key: 'key', title: 'Key' },
      {
        dataIndex: 'maskedValue',
        key: 'maskedValue',
        render: (value: string) => <Text code>{value}</Text>,
        title: '当前值',
      },
      {
        dataIndex: 'configured',
        key: 'configured',
        render: (value: boolean) => (value ? <Tag color="green">已配置</Tag> : <Tag>未配置</Tag>),
        title: '状态',
      },
      {
        key: 'actions',
        render: (_: unknown, row: AdminPlatformPluginSecret) => (
          <Button danger size="small" onClick={() => handleDelete(row)}>
            删除
          </Button>
        ),
        title: '操作',
      },
    ];

    return (
      <Flexbox gap={16}>
        {secrets.length === 0 ? (
          <Empty description="暂无密钥" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <InlineTable columns={columns as any} dataSource={secrets} rowKey="id" />
        )}

        <Form form={form} initialValues={{ scope: 'global' }} layout="vertical">
          <Flexbox horizontal gap={12}>
            <Form.Item label="范围" name="scope" style={{ width: 160 }}>
              <Input placeholder="global" />
            </Form.Item>
            <Form.Item label="Key" name="key" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="API_KEY" />
            </Form.Item>
          </Flexbox>
          <Form.Item label="密钥值" name="value" rules={[{ required: true }]}>
            <Input.Password placeholder="保存后仅显示脱敏值" />
          </Form.Item>
          <Button loading={submitting} type="primary" onClick={handleSave}>
            保存密钥
          </Button>
        </Form>
      </Flexbox>
    );
  },
);

SecretsPanel.displayName = 'SecretsPanel';

export default SecretsPanel;
