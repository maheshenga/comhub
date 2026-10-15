'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, confirmModal, Input, List, Tag, Text, toast } from '@lobehub/ui/base-ui';
import { Space } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { AdminMetricStrip } from './layout';
import { AdminInlineSkeleton } from './shared';

const GOVERNANCE_SWR_KEY = 'admin:settings:governance';

const AdminSettingsGovernanceCard = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading, mutate } = useClientDataSWR(GOVERNANCE_SWR_KEY, () =>
    adminCommercialService.getAppSettingsGovernance(),
  );

  if (isLoading && !data) {
    return (
      <Card>
        <AdminInlineSkeleton rows={3} />
      </Card>
    );
  }

  if (!data) return null;

  const hasUnknownKeys = data.unknownKeys.length > 0;

  const handleDeleteUnknownKey = (key: string) => {
    let typedKey = '';

    confirmModal({
      content: (
        <Flexbox gap={8}>
          <Text type="secondary">
            {t(
              'admin.settings.governance.deleteUnknownDescription',
              '请输入完整 key 以确认删除。此操作只用于清理未注册的历史设置项。',
            )}
          </Text>
          <Text code>{key}</Text>
          <Input
            placeholder={key}
            onChange={(event) => {
              typedKey = event.target.value;
            }}
          />
        </Flexbox>
      ),
      okButtonProps: { danger: true },
      okText: t('admin.settings.governance.deleteUnknownConfirm', '删除'),
      onOk: async () => {
        if (typedKey !== key) {
          toast.error(t('admin.settings.governance.deleteUnknownMismatch', '输入的 key 不匹配'));
          throw new Error('CONFIRMATION_KEY_MISMATCH');
        }

        await adminCommercialService.deleteUnknownAppSetting({ confirmKey: key, key });
        toast.success(t('admin.settings.governance.deleteUnknownSuccess', '未知设置项已删除'));
        await mutate();
      },
      title: t('admin.settings.governance.deleteUnknownTitle', '删除未知设置项？'),
    });
  };

  return (
    <Card
      title={t('admin.settings.governance.title', '设置治理健康检查')}
      extra={
        <Button size="small" onClick={() => mutate()}>
          {t('admin.settings.governance.refresh', '刷新')}
        </Button>
      }
    >
      <Flexbox gap={16}>
        <AdminMetricStrip
          label={t('admin.settings.governance.metricsLabel', '设置治理指标')}
          items={[
            {
              key: 'registered',
              label: t('admin.settings.governance.registered', '已注册设置'),
              value: data.summary.registeredCount,
            },
            {
              key: 'persisted',
              label: t('admin.settings.governance.persisted', '已写入设置'),
              value: data.summary.persistedCount,
            },
            {
              key: 'unknown',
              label: t('admin.settings.governance.unknown', '未知设置'),
              value: data.summary.unknownCount,
            },
            {
              key: 'sensitive',
              label: t('admin.settings.governance.sensitive', '敏感设置'),
              value: data.summary.sensitiveConfiguredCount,
            },
          ]}
        />

        {hasUnknownKeys ? (
          <Alert
            showIcon
            message={t('admin.settings.governance.unknownFound', '发现未注册设置项')}
            type="warning"
            description={t(
              'admin.settings.governance.unknownDescription',
              '这些 key 可能来自旧版本、手工写库或已迁移功能。建议确认后迁移或清理，避免后台重复设置或配置不生效。',
            )}
          />
        ) : (
          <Alert
            showIcon
            message={t('admin.settings.governance.noUnknown', '没有发现未注册设置项')}
            type="success"
          />
        )}

        {hasUnknownKeys && (
          <List
            variant="outlined"
            items={data.unknownKeys.map((item) => ({
              actions: [
                <Button
                  danger
                  key="delete"
                  size="small"
                  onClick={() => handleDeleteUnknownKey(item.key)}
                >
                  {t('admin.settings.governance.deleteUnknown', '删除')}
                </Button>,
              ],
              key: item.key,
              label: <Text code>{item.key}</Text>,
            }))}
          />
        )}

        {data.sensitiveConfiguredKeys.length > 0 && (
          <Flexbox gap={8}>
            <Text type="secondary">
              {t('admin.settings.governance.sensitiveKeys', '已配置敏感项只显示 key，不显示值：')}
            </Text>
            <Space wrap>
              {data.sensitiveConfiguredKeys.map((item) => (
                <Tag color="red" key={item.key}>
                  {item.key}
                </Tag>
              ))}
            </Space>
          </Flexbox>
        )}
      </Flexbox>
    </Card>
  );
});

AdminSettingsGovernanceCard.displayName = 'AdminSettingsGovernanceCard';

export default AdminSettingsGovernanceCard;
