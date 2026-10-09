export const formatBulkApproveChangeRequestResult = (
  t: any,
  value: unknown,
) => {
  const result = value as { results: { ok: boolean; requestId: string }[] };
  const succeeded = result.results.filter((item) => item.ok).length;
  const failed = result.results.length - succeeded;

  return {
    failed,
    requested: result.results.length,
    succeeded,
    title: t('admin.changeRequests.bulkApproveDone', `已通过 ${succeeded} 个，失败 ${failed} 个`),
  };
};

export const formatBulkRejectChangeRequestResult = (
  t: any,
  value: unknown,
) => {
  const result = value as { results: { ok: boolean; requestId: string }[] };
  const succeeded = result.results.filter((item) => item.ok).length;
  const failed = result.results.length - succeeded;

  return {
    failed,
    requested: result.results.length,
    succeeded,
    title: t('admin.changeRequests.bulkRejectDone', `已拒绝 ${succeeded} 个，失败 ${failed} 个`),
  };
};

export type ChangeRequestStatusFilter = 'all' | 'pending' | 'completed' | 'canceled' | 'rejected';

export const STATUS_COLORS: Record<string, string> = {
  canceled: 'default',
  completed: 'success',
  pending: 'processing',
  rejected: 'error',
};

export const REASON_COLORS: Record<string, string> = {
  cycle_change: 'cyan',
  downgrade: 'orange',
  upgrade: 'gold',
};
