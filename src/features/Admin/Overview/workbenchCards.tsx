'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Tag } from '@lobehub/ui/base-ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { ADMIN_BASE_PATH } from '@/features/Admin/adminNavigation';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

export interface WorkbenchTodoCardProps {
  description: string;
  items: Array<{
    hint?: string;
    label: string;
    tag?: string;
    tagColor?: string;
  }>;
  title: string;
  total: number;
  onViewAll: () => void;
  viewAllLabel: string;
}

/** 待办卡：徽标计数 + 前 N 条 + 「查看全部」（§2.3 工作台五卡片）。 */
export const WorkbenchTodoCard = ({
  description,
  items,
  title,
  total,
  onViewAll,
  viewAllLabel,
}: WorkbenchTodoCardProps) => (
  <Flexbox gap={10}>
    <Flexbox horizontal align="center" gap={8}>
      <Tag color={total > 0 ? 'processing' : 'success'}>{title}</Tag>
      <strong>{total}</strong>
    </Flexbox>
    <p style={{ margin: 0, opacity: 0.72 }}>{description}</p>
    <Flexbox gap={6}>
      {items.slice(0, 5).map((item, index) => (
        <Flexbox horizontal align="center" gap={8} key={`${item.label}-${index}`}>
          {item.tag ? <Tag color={item.tagColor ?? 'default'}>{item.tag}</Tag> : null}
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.label}
          </span>
          {item.hint ? <small style={{ opacity: 0.6 }}>{item.hint}</small> : null}
        </Flexbox>
      ))}
      {items.length === 0 ? <small style={{ opacity: 0.6 }}>—</small> : null}
    </Flexbox>
    <Button size="small" onClick={onViewAll}>
      {viewAllLabel}
    </Button>
  </Flexbox>
);

/** 最近审计卡：当前管理员的最近操作（actorUserId 过滤）。 */
export const WorkbenchAuditCard = ({
  items,
  onOpenAudit,
  t,
}: {
  items: Array<{ action: string; createdAt: string | Date }>;
  onOpenAudit: () => void;
  t: TFn;
}) => {
  const navigate = useNavigate();

  return (
    <Flexbox gap={10}>
      <Flexbox horizontal align="center" gap={8}>
        <Tag color="default">{t('admin.workbench.recentAudit', '我最近的操作')}</Tag>
        <strong>{items.length}</strong>
      </Flexbox>
      <Flexbox gap={6}>
        {items.slice(0, 10).map((item, index) => (
          <Flexbox horizontal align="center" gap={8} key={`${item.action}-${index}`}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.action}
            </span>
            <small style={{ opacity: 0.6 }}>
              {new Date(item.createdAt).toLocaleString()}
            </small>
          </Flexbox>
        ))}
        {items.length === 0 ? <small style={{ opacity: 0.6 }}>—</small> : null}
      </Flexbox>
      <Button size="small" onClick={() => navigate(`${ADMIN_BASE_PATH}/audit`)}>
        {t('admin.workbench.openAudit', '打开审计记录')}
      </Button>
    </Flexbox>
  );
};
