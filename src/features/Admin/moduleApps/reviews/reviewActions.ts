import { toast } from '@lobehub/ui';

import { mutate } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { moduleAppCacheKeys } from '../shared/cacheKeys';
import type { AdminModuleAppOutboundHostPurpose, AdminModuleAppPackageRow } from '../types';
import { actionReceipt } from './packageColumns';

type ReviewAction = 'approve' | 'reject' | 'rescan';

type ActionInput = {
  action: ReviewAction;
  listKey: ReturnType<typeof moduleAppCacheKeys.packages>;
  outboundHostPolicies: { host: string; purpose: AdminModuleAppOutboundHostPurpose }[];
  rejectReason: string;
  target: AdminModuleAppPackageRow;
  translate: (key: 'moduleApps.admin.reviews.actionSuccess') => string;
};

/**
 * 审核台三项写操作（批准/驳回/重扫）的提交逻辑：成功后失效列表与详情缓存，
 * 并用带回执文案的 toast 告知管理员批的是哪个包——原文案只有一句「操作已
 * 完成」，弹窗一关队列就停在原地。
 */
export const submitReviewAction = async (input: ActionInput): Promise<void> => {
  const { action, listKey, outboundHostPolicies, rejectReason, target, translate } = input;
  if (action === 'approve') {
    const result = await adminCommercialService.moduleApps.approvePackage({
      outboundHostPolicies,
      packageId: target.id,
    });
    await mutate(listKey);
    await mutate(moduleAppCacheKeys.detail(result.appId));
    await mutate(
      (key) => Array.isArray(key) && key[0] === 'admin-module-apps' && key[1] === 'apps',
      undefined,
      { revalidate: true },
    );
  } else if (action === 'reject') {
    await adminCommercialService.moduleApps.rejectPackage({
      packageId: target.id,
      reason: rejectReason,
    });
    await mutate(listKey);
  } else {
    await adminCommercialService.moduleApps.rescanPackage({ packageId: target.id });
    await mutate(listKey);
  }
  toast.success(actionReceipt(translate, target));
};
