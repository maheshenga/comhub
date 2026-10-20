'use client';

import { type AdminDependencyImpact, type AdminDependencyImpactItem } from '@lobechat/types';
import { Alert, Flexbox, Tag, Text } from '@lobehub/ui';
import { type TFunction } from 'i18next';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { AdminInlineSkeleton } from '@/features/Admin/shared';

/**
 * 影响条目标题按稳定 code 走 i18n（admin.impact.item.<code>）；服务端 title
 * 现返回同一 code 兜底，未知 code（如上游新增）直接显示 title 原文不炸。
 */
const ImpactItems = ({
  items,
  t,
}: {
  items: AdminDependencyImpactItem[];
  t: TFunction<'subscription'>;
}) => (
  <Flexbox gap={6}>
    {items.map((item) => (
      <Flexbox gap={2} key={item.code}>
        <Flexbox horizontal align="center" gap={6}>
          <Text strong>{t(`admin.impact.item.${item.code}`, item.title)}</Text>
          <Tag>{item.count}</Tag>
        </Flexbox>
        {item.details?.length ? (
          <Text type="secondary">{item.details.slice(0, 5).join(', ')}</Text>
        ) : null}
      </Flexbox>
    ))}
  </Flexbox>
);

const AdminDependencyImpactPreview = memo<{
  error?: boolean;
  impact?: AdminDependencyImpact;
  loading?: boolean;
}>(({ error, impact, loading }) => {
  const { t } = useTranslation('subscription');

  if (loading) return <AdminInlineSkeleton rows={2} />;
  if (error) {
    return (
      <Alert
        showIcon
        message={t('admin.impact.loadFailed', '无法加载依赖影响，已阻止继续操作。')}
        type="error"
      />
    );
  }
  if (!impact) return null;
  if (!impact.targetExists) {
    return (
      <Alert
        showIcon
        message={t('admin.impact.targetMissing', '目标已不存在，请刷新页面。')}
        type="error"
      />
    );
  }

  return (
    <Flexbox gap={10}>
      {impact.blocking.length > 0 ? (
        <Alert
          showIcon
          description={<ImpactItems items={impact.blocking} t={t} />}
          message={t('admin.impact.blocking', '必须先处理的阻断依赖')}
          type="error"
        />
      ) : (
        <Alert showIcon message={t('admin.impact.noBlocking', '未发现阻断依赖')} type="success" />
      )}
      {impact.immediateEffects.length > 0 ? (
        <Alert
          showIcon
          description={<ImpactItems items={impact.immediateEffects} t={t} />}
          message={t('admin.impact.immediate', '确认后立即发生')}
          type="warning"
        />
      ) : null}
      {impact.liveEffects.length > 0 ? (
        <Alert
          showIcon
          description={<ImpactItems items={impact.liveEffects} t={t} />}
          message={t('admin.impact.live', '在线运行影响')}
          type="info"
        />
      ) : null}
    </Flexbox>
  );
});

AdminDependencyImpactPreview.displayName = 'AdminDependencyImpactPreview';

export default AdminDependencyImpactPreview;
