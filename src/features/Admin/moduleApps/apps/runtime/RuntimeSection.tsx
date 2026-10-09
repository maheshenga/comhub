'use client';

import { type ReactNode } from 'react';
import { Link } from 'react-router';

import ModulePageState from '../../shared/ModulePageState';
import { runtimeStyles as styles } from './runtimeStyles';

type ListResponse<T> = { items?: T[]; nextCursor?: null | string };

export type RuntimeSectionProps<T> = {
  children: ReactNode;
  data?: ListResponse<T>;
  emptyDescription: string;
  emptyTitle: string;
  error?: unknown;
  href: string;
  isLoading?: boolean;
  onRetry: () => void;
  testId: string;
  title: string;
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
  onRetry,
  testId,
  title,
}: RuntimeSectionProps<T>) => (
  <section className={styles.section} data-testid={testId}>
    <header className={styles.header}>
      <h2>{title}</h2>
      <Link to={href}>{title}</Link>
    </header>
    <ModulePageState
      emptyDescription={emptyDescription}
      emptyTitle={emptyTitle}
      error={error}
      isEmpty={!isLoading && !error && (data?.items?.length ?? 0) === 0}
      loading={isLoading}
      onRetry={onRetry}
    >
      {children}
    </ModulePageState>
  </section>
);
