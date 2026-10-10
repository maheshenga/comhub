import { toast } from '@lobehub/ui/base-ui';
import { useState } from 'react';

import { mutate } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import type { ModuleAppPublisherRow } from '../PublisherTable';
import { moduleAppCacheKeys } from '../shared/cacheKeys';

type TFn = (key: any, defaultValue?: any, values?: any) => any;

export type GovernanceAction = 'assign' | 'suspend' | 'verify';

const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

const appListFamilyPredicate = (key: unknown) =>
  Array.isArray(key) && key[0] === 'admin-module-apps' && key[1] === 'apps';
const publisherListFamilyPredicate = (key: unknown) =>
  Array.isArray(key) && key[0] === 'admin-module-apps' && key[1] === 'publishers';
const invalidatePublisherLists = () =>
  mutate(publisherListFamilyPredicate, undefined, { revalidate: true });

/**
 * 发布商治理动作状态机（M5 拆页：从 ModulePublishersPage 抽出）。
 * verify / suspend / assign 三态动作弹窗 + UUID 校验 + 缓存失效。
 */
export const usePublisherGovernance = ({ t }: { t: TFn }) => {
  const [action, setAction] = useState<GovernanceAction>();
  const [appId, setAppId] = useState('');
  const [error, setError] = useState<string>();
  const [selectedPublisher, setSelectedPublisher] = useState<ModuleAppPublisherRow>();
  const [submitting, setSubmitting] = useState(false);
  const openAction = (nextAction: GovernanceAction, publisher: ModuleAppPublisherRow) => {
    setAction(nextAction);
    setAppId('');
    setError(undefined);
    setSelectedPublisher(publisher);
  };
  const submitAction = async () => {
    const normalizedAppId = appId.trim();
    const appIdIsValid = UUID_PATTERN.test(normalizedAppId);
    if (!action || !selectedPublisher || (action === 'assign' && !appIdIsValid)) return;
    setSubmitting(true);
    setError(undefined);
    try {
      if (action === 'verify') {
        await adminCommercialService.moduleApps.verifyPublisher({
          publisherId: selectedPublisher.id,
          verificationMetadata: {},
        });
      } else if (action === 'suspend') {
        await adminCommercialService.moduleApps.suspendPublisher({
          publisherId: selectedPublisher.id,
        });
      } else {
        await adminCommercialService.moduleApps.assignPublisher({
          appId: normalizedAppId,
          publisherId: selectedPublisher.id,
        });
        await Promise.all([
          mutate(moduleAppCacheKeys.detail(normalizedAppId)),
          mutate(appListFamilyPredicate, undefined, { revalidate: true }),
        ]);
      }
      await invalidatePublisherLists();
      toast.success(t(`moduleApps.admin.publishers.${action}Success`));
      setAction(undefined);
      setSelectedPublisher(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t('moduleApps.admin.publishers.actionError'),
      );
    } finally {
      setSubmitting(false);
    }
  };
  const appIdIsValid = UUID_PATTERN.test(appId.trim());

  return {
    action,
    appId,
    appIdIsValid,
    closeAction: () => {
      if (!submitting) setAction(undefined);
    },
    error,
    openAction,
    setAppId,
    submitAction,
    submitting,
  };
};
