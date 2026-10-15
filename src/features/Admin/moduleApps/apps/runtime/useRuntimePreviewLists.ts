'use client';

import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { moduleAppCacheKeys } from '../../shared/cacheKeys';
import type {
  ModuleAppArtifactRow,
  ModuleAppInstallRow,
  ModuleAppRecordRow,
  ModuleAppRunRow,
} from '../../types';
import { RUNTIME_PREVIEW_LIMIT } from './RuntimeSection';

type ListResponse<T> = { items?: T[]; nextCursor?: null | string };

/**
 * Runtime 页四个同构预览列表（installs/records/runs/artifacts）的 SWR 接线
 * 与 key 推导。从 ModuleAppRuntimePage 抽出，让页面留在 300 行预算内。
 */
export const useRuntimePreviewLists = (appId: string | undefined) => {
  const listFetcher =
    (method: 'listArtifacts' | 'listInstalls' | 'listRecords' | 'listRuns') => () =>
      adminCommercialService.moduleApps[method]({
        appId: appId!,
        cursor: undefined,
        limit: RUNTIME_PREVIEW_LIMIT,
      }) as unknown as Promise<ListResponse<never>>;

  const installsKey = appId
    ? moduleAppCacheKeys.runtime('installs', appId, RUNTIME_PREVIEW_LIMIT)
    : null;
  const recordsKey = appId
    ? moduleAppCacheKeys.runtime('records', appId, RUNTIME_PREVIEW_LIMIT)
    : null;
  const runsKey = appId ? moduleAppCacheKeys.runtime('runs', appId, RUNTIME_PREVIEW_LIMIT) : null;
  const artifactsKey = appId
    ? moduleAppCacheKeys.runtime('artifacts', appId, RUNTIME_PREVIEW_LIMIT)
    : null;

  const installs = useClientDataSWR<ListResponse<ModuleAppInstallRow>>(
    installsKey,
    listFetcher('listInstalls') as () => Promise<ListResponse<ModuleAppInstallRow>>,
  );
  const records = useClientDataSWR<ListResponse<ModuleAppRecordRow>>(
    recordsKey,
    listFetcher('listRecords') as () => Promise<ListResponse<ModuleAppRecordRow>>,
  );
  const runs = useClientDataSWR<ListResponse<ModuleAppRunRow>>(
    runsKey,
    listFetcher('listRuns') as () => Promise<ListResponse<ModuleAppRunRow>>,
  );
  const artifacts = useClientDataSWR<ListResponse<ModuleAppArtifactRow>>(
    artifactsKey,
    listFetcher('listArtifacts') as () => Promise<ListResponse<ModuleAppArtifactRow>>,
  );

  return { artifacts, artifactsKey, installs, installsKey, records, recordsKey, runs, runsKey };
};
