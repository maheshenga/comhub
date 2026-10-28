'use client';

import { createStaticStyles } from '@lobehub/ui';

/**
 * 应用详情子页（configuration / entitlements）共享样式壳：对齐 overview /
 * runtime 子页的 header 分隔线 + 页面栅格，二者此前是无样式裸 <section>。
 */
export const detailSubPageStyles = createStaticStyles(({ css, cssVar }) => ({
  description: css`
    margin-block: 4px 0;
    margin-inline: 0;

    font-size: 13px;
    line-height: 20px;
    color: ${cssVar.colorTextSecondary};
  `,
  header: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: baseline;
    justify-content: space-between;

    padding-block-end: 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  page: css`
    display: grid;
    gap: 20px;
    min-width: 0;

    @media (width < 640px) {
      gap: 16px;
    }
  `,
  title: css`
    margin: 0;

    font-size: 20px;
    font-weight: 600;
    line-height: 28px;
    color: ${cssVar.colorText};
  `,
}));
