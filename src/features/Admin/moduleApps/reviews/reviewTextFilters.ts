'use client';

import { useMemo } from 'react';

import { useDebouncedFilter } from '../shared/useDebouncedFilter';

/**
 * 审核台三个文本筛选（appId/publisherId/submittedByUserId）的防抖接线：
 * 逐键直写 URL 会让粘贴一个 36 位 UUID 打出 36 个请求。返回 debounced 值
 * 与统一 dispatcher——Select 类筛选仍即时回写，文本筛选走 250ms 静默期。
 */
export const useReviewTextFilters = (
  appId: string,
  publisherId: string,
  submittedByUserId: string,
): [
  Record<'appId' | 'publisherId' | 'submittedByUserId', string>,
  (name: string, value: string) => void,
] => {
  const [appIdInput, setAppIdInput] = useDebouncedFilter('appId', appId);
  const [publisherIdInput, setPublisherIdInput] = useDebouncedFilter('publisherId', publisherId);
  const [submittedByInput, setSubmittedByInput] = useDebouncedFilter(
    'submittedByUserId',
    submittedByUserId,
  );
  const textFilterHandlers = useMemo(
    () => ({
      appId: setAppIdInput,
      publisherId: setPublisherIdInput,
      submittedByUserId: setSubmittedByInput,
    }),
    [setAppIdInput, setPublisherIdInput, setSubmittedByInput],
  );
  const inputs = useMemo(
    () => ({
      appId: appIdInput,
      publisherId: publisherIdInput,
      submittedByUserId: submittedByInput,
    }),
    [appIdInput, publisherIdInput, submittedByInput],
  );
  return [
    inputs,
    (name: string, value: string) => {
      const textSetter = textFilterHandlers[name as keyof typeof textFilterHandlers];
      return textSetter?.(value);
    },
  ];
};
