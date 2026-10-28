'use client';

import { createStaticStyles } from '@lobehub/ui';

export const moduleReviewsStyles = createStaticStyles(({ css, cssVar }) => ({
  controls: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  pagePosition: css`
    align-self: center;
    color: ${cssVar.colorTextTertiary};
    font-size: 12px;
    white-space: nowrap;
  `,
  hostList: css`
    display: grid;
    gap: 12px;
  `,
  hostRow: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(160px, 220px);
    gap: 12px;
    align-items: center;

    @media (width <= 640px) {
      grid-template-columns: 1fr;
    }
  `,
  hostName: css`
    overflow-wrap: anywhere;
  `,
  page: css`
    display: grid;
    gap: 16px;
    max-width: 1180px;
  `,
  table: css`
    border-collapse: collapse;
    width: 100%;

    th,
    td {
      padding-block: 10px;
      padding-inline: 8px;
      border-block-end: 1px solid ${cssVar.colorBorderSecondary};
      text-align: start;
    }
  `,
  tableFrame: css`
    overflow-x: auto;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorBgContainer};
  `,
}));
