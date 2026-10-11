import { AsyncTaskStatus } from '@lobechat/types';
import { useEffect, useRef } from 'react';

import { useClientPollingSWR } from '@/libs/swr';
import { userMemoryKeys } from '@/libs/swr/keys';
import { type MemoryExtractionTask } from '@/services/userMemory/extraction';
import { memoryExtractionService } from '@/services/userMemory/extraction';

/** 运行态轮询节奏。终态后立即停表，不留尾随请求。 */
const ACTIVE_POLL_INTERVAL = 5000;
const ACTIVE_POLL_MAX_INTERVAL = 60_000;
const ACTIVE_POLL_MAX_BACKOFF_EXPONENT = 4;

const isActiveStatus = (status: AsyncTaskStatus) =>
  status === AsyncTaskStatus.Pending || status === AsyncTaskStatus.Processing;

export const useMemoryAnalysisAsyncTask = (taskId?: string) => {
  const swr = useClientPollingSWR<MemoryExtractionTask | null>(
    taskId ? userMemoryKeys.analysisTask(taskId) : userMemoryKeys.analysisTask(),
    () => memoryExtractionService.getTask(taskId),
    {
      // 唯一的轮询源。此前 SWR 的 30s refreshInterval 与一个手写 5s
      // setInterval 并存，同一 taskId 上重复请求；且 useClientDataSWR 全局
      // dedupingInterval=0、mutate 路径会删掉 FETCH[key]，重叠请求不会被去重
      // ——同一个 taskId 的 4 个挂载点各建一个定时器，请求量按挂载数成倍放大。
      // refreshInterval 是函数式的，退避与隐藏态门禁都在这里生效。
      refreshInterval: (latest) => {
        if (!latest || !isActiveStatus(latest.status)) return 0;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return 0;

        return ACTIVE_POLL_INTERVAL;
      },
      // 标签页切后台即停；回到前台由 SWR 的 revalidateOnFocus 立即补一次，
      // 不必等到下一个轮询周期。
      refreshWhenHidden: false,
    },
  );

  const status = swr.data?.status;
  const taskIdentity = swr.data?.id;
  // 失败计数不进 React state：它只驱动间隔重算，放 ref 才不会让订阅该 hook 的
  // 组件（记忆首页 / Status / AnalysisTrigger / DateRangeModal）无谓重渲染。
  const failureCountRef = useRef(0);

  useEffect(() => {
    if (!taskIdentity || !status || !isActiveStatus(status)) return;

    let cancelled = false;
    let timer: number | undefined;
    let inFlight = false;
    let queued = false;

    const isVisible = () =>
      typeof document === 'undefined' || document.visibilityState !== 'hidden';

    const schedule = () => {
      const interval = Math.min(
        ACTIVE_POLL_MAX_INTERVAL,
        ACTIVE_POLL_INTERVAL * 2 ** failureCountRef.current,
      );
      timer = window.setTimeout(run, interval);
    };

    async function run() {
      if (cancelled || !isVisible()) return;
      // 慢网下上一次请求可能还没回来。不加这道闸，定时器会无限叠请求。
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      try {
        await swr.mutate();
        failureCountRef.current = 0;
      } catch {
        failureCountRef.current = Math.min(
          failureCountRef.current + 1,
          ACTIVE_POLL_MAX_BACKOFF_EXPONENT,
        );
      } finally {
        inFlight = false;
        if (!cancelled) {
          if (queued) {
            queued = false;
            void run();
          } else {
            schedule();
          }
        }
      }
    }

    const handleVisibility = () => {
      if (cancelled) return;
      if (isVisible()) {
        // 回到前台立刻补一次，不等剩余间隔。
        window.clearTimeout(timer);
        timer = undefined;
        void run();
      } else {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    schedule();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // swr.mutate 是稳定引用；data.id/status 变化时重排即可，不订阅整个 swr。
  }, [taskIdentity, status, swr.mutate]);

  return {
    ...swr,
    refresh: swr.mutate,
  };
};
