'use client';

import { createStaticStyles } from '@lobehub/ui';

/** ModuleAppRuntimePage 及其子区块共享样式（M5 拆页抽离）。 */
export const runtimeStyles = createStaticStyles(({ css, cssVar }) => ({
  diagnosticCode: css`
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    overflow-wrap: anywhere;
  `,
  diagnosticActions: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    align-items: center;
  `,
  diagnosticAction: css`
    display: inline-flex;
    gap: 6px;
    align-items: center;

    color: ${cssVar.colorLink};
    text-decoration: none;

    &:hover {
      color: ${cssVar.colorLinkHover};
    }

    svg {
      flex: none;
    }
  `,
  diagnosticGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0 20px;
    margin: 0;
  `,
  diagnosticGroup: css`
    display: grid;
    gap: 10px;

    h3,
    p {
      margin: 0;
    }

    p {
      color: ${cssVar.colorTextSecondary};
    }
  `,
  diagnosticItem: css`
    display: grid;
    gap: 6px;

    min-width: 0;
    margin: 0;
    padding-block: 10px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    dd {
      margin: 0;
    }
  `,
  diagnosticLabel: css`
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
  diagnosticStatus: css`
    display: inline-flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;

    width: fit-content;
    max-width: 100%;

    color: ${cssVar.colorText};

    &[data-tone='positive'] {
      color: ${cssVar.colorSuccess};
    }

    &[data-tone='warning'] {
      color: ${cssVar.colorWarning};
    }

    &[data-tone='negative'] {
      color: ${cssVar.colorError};
    }
  `,
  diagnosticStatusDot: css`
    flex: none;

    width: 8px;
    height: 8px;
    border-radius: 50%;

    background: currentcolor;
  `,
  header: css`
    display: flex;
    gap: 12px;
    align-items: baseline;
    justify-content: space-between;
  `,
  /**
   * 子页页头（h1 + 描述）：与 detailSubPageStyles.header 同构（分隔线 + 排版），
   * 独立 token——styles.header 被区块内 header 复用，不能带分隔线。
   */
  pageHeader: css`
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
  `,
  section: css`
    display: grid;
    gap: 10px;
    padding-block: 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  title: css`
    margin: 0;

    font-size: 20px;
    font-weight: 600;
    line-height: 28px;
    color: ${cssVar.colorText};
  `,
  description: css`
    margin-block: 4px 0;
    margin-inline: 0;

    font-size: 13px;
    line-height: 20px;
    color: ${cssVar.colorTextSecondary};
  `,
  truncated: css`
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
  `,
}));
