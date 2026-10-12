'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { setFilter } from './queryState';

/**
 * 文本筛选的防抖回写：受控输入逐键变化时，250ms 静默期后才写入 URL（并因此
 * 触发列表请求）。目录页的搜索框早就是这个行为（ModuleAppsPage 的手写
 * setTimeout effect），其余列表页（审核台/资金/发布商）的文本筛选此前都是
 * 逐键直写 URL——粘贴一个 36 位 UUID 会打出 36 个请求。本 hook 把该 effect
 * 下沉为共享实现，各页只需换成 debounced 值接线。
 *
 * 外部 URL 变化（浏览器后退、清除筛选）仍即时生效：query 依赖触发时直接
 * 同步本地输入。
 */
export const useDebouncedFilter = (
  name: string,
  urlValue: string,
  delayMs = 250,
): [string, (next: string) => void] => {
  const [, setSearchParams] = useSearchParams();
  const [input, setInput] = useState(urlValue);

  useEffect(() => {
    setInput(urlValue);
  }, [urlValue]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (input === urlValue) return;
      setSearchParams(
        (current) => setFilter(current, name, input.trim() || undefined),
        { replace: true },
      );
    }, delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, input, name, setSearchParams, urlValue]);

  return [input, setInput];
};
