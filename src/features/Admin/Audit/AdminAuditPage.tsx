'use client';

import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import AdminUserDetailDrawer from '@/features/Admin/AdminUserDetailDrawer';
import { buildAuditColumns } from '@/features/Admin/Audit/auditColumns';
import {
  AuditDetailModal,
  AuditEmptyState,
  type AuditFilterKey,
  type AuditRow,
  escapeAuditCsv,
  groupAuditRowsByBatch,
  readBatchCorrelationId,
} from '@/features/Admin/Audit/auditParts';
import { AdminAuditTableSection } from '@/features/Admin/Audit/auditTableSection';
import { AdminPageError, AdminPageShell, AdminSection, AdminToolbar } from '@/features/Admin/layout';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { AuditFilterBar } from './auditFilterBar';
import type { Dayjs } from 'dayjs';

const PAGE_SIZE = 50;

const AdminAuditPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [searchParams] = useSearchParams();
  const [actorFilter, setActorFilter] = useState(() => searchParams.get('actorUserId') ?? '');
  const [targetFilter, setTargetFilter] = useState(() => searchParams.get('targetUserId') ?? '');
  const [actionFilter, setActionFilter] = useState(() => searchParams.get('action') ?? '');
  const [resourceTypeFilter, setResourceTypeFilter] = useState(
    () => searchParams.get('resourceType') ?? '',
  );
  const [resourceIdFilter, setResourceIdFilter] = useState(
    () => searchParams.get('resourceId') ?? '',
  );
  const [batchFilter, setBatchFilter] = useState(() => searchParams.get('batchId') ?? '');
  const [dateRangeFilter, setDateRangeFilter] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [drawerUser, setDrawerUser] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const fromFilter = dateRangeFilter?.[0]?.startOf('day').toISOString();
  const toFilter = dateRangeFilter?.[1]?.endOf('day').toISOString();

  const swrKey = useMemo(
    () =>
      [
        'admin-audit',
        actorFilter,
        targetFilter,
        actionFilter,
        resourceTypeFilter,
        resourceIdFilter,
        batchFilter,
        fromFilter,
        toFilter,
        cursor,
      ] as const,
    [
      actorFilter,
      targetFilter,
      actionFilter,
      resourceTypeFilter,
      resourceIdFilter,
      batchFilter,
      fromFilter,
      toFilter,
      cursor,
    ],
  );

  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useClientDataSWR(swrKey, () =>
    adminCommercialService.listAudit({
      action: actionFilter || undefined,
      actorUserId: actorFilter || undefined,
      batchCorrelationId: batchFilter || undefined,
      cursor,
      from: fromFilter,
      limit: PAGE_SIZE,
      resourceId: resourceIdFilter || undefined,
      resourceType: resourceTypeFilter || undefined,
      targetUserId: targetFilter || undefined,
      to: toFilter,
    }),
  );

  const items = (data?.items ?? []) as AuditRow[];
  const groups = useMemo(() => groupAuditRowsByBatch(items), [items]);

  const handleFilterChange = (key: AuditFilterKey, value: string) => {
    if (key === 'action') setActionFilter(value);
    else if (key === 'actorUserId') setActorFilter(value);
    else if (key === 'batchCorrelationId') setBatchFilter(value);
    else if (key === 'resourceId') setResourceIdFilter(value);
    else if (key === 'resourceType') setResourceTypeFilter(value);
    else if (key === 'targetUserId') setTargetFilter(value);
    setCursor(0);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await adminCommercialService.exportAudit({
        action: actionFilter || undefined,
        actorUserId: actorFilter || undefined,
        batchCorrelationId: batchFilter || undefined,
        from: fromFilter,
        limit: 5000,
        resourceId: resourceIdFilter || undefined,
        resourceType: resourceTypeFilter || undefined,
        targetUserId: targetFilter || undefined,
        to: toFilter,
      });
      const header = [
        'createdAt',
        'action',
        'actorUserId',
        'targetUserId',
        'resourceType',
        'resourceId',
        'batchCorrelationId',
        'ipAddress',
        'payload',
      ];
      const lines = [header.join(',')];
      for (const row of res.items as AuditRow[]) {
        lines.push(
          [
            new Date(row.createdAt).toISOString(),
            row.action,
            row.actorUserId,
            row.targetUserId,
            row.resourceType,
            row.resourceId,
            readBatchCorrelationId(row),
            row.ipAddress,
            row.payload,
          ]
            .map(escapeAuditCsv)
            .join(','),
        );
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.download = `admin-audit-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.csv`;
      anchor.href = url;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      // 导出失败保持静默（错误态由页面级 error 处理）。
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminPageShell
      description={t(
        'admin.audit.description',
        '检索管理员操作、目标对象和资源变更，并按筛选条件导出审计记录。',
      )}
      title={t('admin.audit.title', '审计记录')}
      width="full"
    >
      <AdminSection
        description={t('admin.audit.resultSummary', '按操作者、目标、资源或时间范围筛选。')}
        title={t('admin.audit.listTitle', '操作日志')}
      >
        <AdminToolbar>
          <AuditFilterBar
            actionFilter={actionFilter}
            actorFilter={actorFilter}
            batchFilter={batchFilter}
            dateRangeFilter={dateRangeFilter}
            exporting={exporting}
            resourceIdFilter={resourceIdFilter}
            resourceTypeFilter={resourceTypeFilter}
            targetFilter={targetFilter}
            onDateRangeChange={(value) => {
              setDateRangeFilter(value);
              setCursor(0);
            }}
            onExport={handleExport}
            onFilterChange={handleFilterChange}
            t={t as any}
          />
        </AdminToolbar>

        {error ? (
          <AdminPageError
            description={t('admin.audit.loadFailed', '审计日志加载失败，请重试。')}
            onRetry={refresh}
          />
        ) : items.length === 0 && !isLoading ? (
          <AuditEmptyState description={t('admin.audit.empty', '暂无审计日志')} />
        ) : (
          <AdminAuditTableSection
            columns={buildAuditColumns({
              onOpenUser: (userId: string) => setDrawerUser(userId),
              t: t as any,
            })}
            groups={groups}
            hasMore={data?.nextCursor != null}
            loading={isLoading}
            nextCursor={data?.nextCursor ?? null}
            onCursor={(next) => setCursor(next)}
            onDetail={setDetail}
            onFilterBatch={(id) => {
              setBatchFilter(id);
              setCursor(0);
            }}
            t={t as any}
          />
        )}
      </AdminSection>

      <AuditDetailModal
        detail={detail}
        title={t('admin.audit.detail.title', '审计日志详情')}
        onClose={() => setDetail(null)}
      />

      <AdminUserDetailDrawer userId={drawerUser} onClose={() => setDrawerUser(null)} />
    </AdminPageShell>
  );
});

AdminAuditPage.displayName = 'AdminAuditPage';

export default AdminAuditPage;

