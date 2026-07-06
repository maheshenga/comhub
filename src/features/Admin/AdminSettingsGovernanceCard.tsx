'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, List, Skeleton, Space, Tag, Typography } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text } = Typography;
const GOVERNANCE_SWR_KEY = 'admin:settings:governance';

const Metric = ({ amount, label }: { amount: number; label: string }) => (
  <Flexbox gap={2} style={{ minWidth: 120 }}>
    <Text type="secondary">{label}</Text>
    <Text strong style={{ fontSize: 24, lineHeight: 1.2 }}>
      {amount}
    </Text>
  </Flexbox>
);

const AdminSettingsGovernanceCard = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading, mutate } = useClientDataSWR(GOVERNANCE_SWR_KEY, () =>
    adminCommercialService.getAppSettingsGovernance(),
  );

  if (isLoading && !data) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  }

  if (!data) return null;

  const hasUnknownKeys = data.unknownKeys.length > 0;

  return (
    <Card
      extra={
        <Button size="small" onClick={() => mutate()}>
          {t('admin.settings.governance.refresh', '刷新')}
        </Button>
      }
      title={t('admin.settings.governance.title', '设置治理健康检查')}
    >
      <Flexbox gap={16}>
        <Space wrap>
          <Metric
            amount={data.summary.registeredCount}
            label={t('admin.settings.governance.registered', '已注册设置')}
          />
          <Metric
            amount={data.summary.persistedCount}
            label={t('admin.settings.governance.persisted', '已写入设置')}
          />
          <Metric
            amount={data.summary.unknownCount}
            label={t('admin.settings.governance.unknown', '未知设置')}
          />
          <Metric
            amount={data.summary.sensitiveConfiguredCount}
            label={t('admin.settings.governance.sensitive', '敏感设置')}
          />
        </Space>

        {hasUnknownKeys ? (
          <Alert
            showIcon
            description={t(
              'admin.settings.governance.unknownDescription',
              '这些 key 可能来自旧版本、手工写库或已迁移功能。建议确认后迁移或清理，避免后台重复设置或配置不生效。',
            )}
            message={t('admin.settings.governance.unknownFound', '发现未注册设置项')}
            type="warning"
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
            bordered
            dataSource={data.unknownKeys}
            renderItem={(item) => <List.Item>{item.key}</List.Item>}
            size="small"
          />
        )}

        {data.sensitiveConfiguredKeys.length > 0 && (
          <Flexbox gap={8}>
            <Text type="secondary">
              {t(
                'admin.settings.governance.sensitiveKeys',
                '已配置敏感项只显示 key，不显示值：',
              )}
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
