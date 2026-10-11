'use client';

import { type ReactNode } from 'react';
import { Link } from 'react-router';

import ModulePageState from '../../shared/ModulePageState';
import { runtimeStyles as styles } from './runtimeStyles';

type ListResponse<T> = { items?: T[]; nextCursor?: null | string };

/**
 * 运行时页四个内联区块的预览条数。服务端在该条数内若还有更多会返回
 * nextCursor，RuntimeSection 据此渲染截断提示，避免管理员把「只显示前 10 条」
 * 误读成「一共就 10 条」。
 */
export const RUNTIME_PREVIEW_LIMIT = 10;

export type RuntimeSectionProps<T> = {
  children: ReactNode;
  data?: ListResponse<T>;
  emptyDescription: string;
  emptyTitle: string;
  error?: unknown;
  href: string;
  isLoading?: boolean;
  /** 本区块请求条数；满额即意味着可能还有更多，用于渲染截断提示。 */
  limit?: number;
  onRetry: () => void;
  testId: string;
  title: string;
  /** 截断提示文案；不传则不渲染（页面自行决定是否需要）。 */
  truncatedLabel?: ReactNode;
};

/** 运行时子区块外壳（标题 + 链接 + 三态），供 installs/records/runs/artifacts 复用。 */
export const RuntimeSection = <T,>({
  children,
  data,
  emptyDescription,
  emptyTitle,
  error,
  href,
  isLoading,
  limit,
  onRetry,
  testId,
  title,
  truncatedLabel,
}: RuntimeSectionProps<T>) => {
  const itemCount = data?.items?.length ?? 0;
  // 四个区块都按 limit 拉取且不翻页。服务端在满额时会给出 nextCursor，此前这个
  // 字段被直接丢掉，管理员看到 10 行时分不清「一共就 10 条」和「被截断到 10 条」。
  const isTruncated = Boolean(data?.nextCursor) && typeof limit === 'number' && itemCount >= limit;

  return (
    <section className={styles.section} data-testid={testId}>
      <header className={styles.header}>
        <h2>{title}</h2>
        <Link to={href}>{title}</Link>
      </header>
      <ModulePageState
        emptyDescription={emptyDescription}
        emptyTitle={emptyTitle}
        error={error}
        isEmpty={!isLoading && !error && itemCount === 0}
        loading={isLoading}
        onRetry={onRetry}
      >
        {children}
        {isTruncated && truncatedLabel ? (
          <p className={styles.truncated} data-testid={`${testId}-truncated`} role="status">
            {truncatedLabel}
          </p>
        ) : null}
      </ModulePageState>
    </section>
  );
};
