'use client';

import { createStaticStyles } from 'antd-style';

import type { ContentMode } from './shared';

export const contentStyles = createStaticStyles(({ css }) => ({
  filters: css`
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;

    min-width: 0;
  `,
  pagination: css`
    display: flex;
    justify-content: center;
  `,
  search: css`
    flex: 1 1 280px;
    min-width: min(240px, 100%);
    max-width: 360px;

    @media (width < 640px) {
      max-width: none;
    }
  `,
  select: css`
    flex: 0 1 160px;
    min-width: min(160px, 100%);

    @media (width < 640px) {
      flex: 1 1 160px;
    }
  `,
  userSearch: css`
    flex: 1 1 220px;
    min-width: min(220px, 100%);
    max-width: 280px;

    @media (width < 640px) {
      max-width: none;
    }
  `,
}));

export type { ContentMode };
