'use client';

import { createStaticStyles } from 'antd-style';

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
  page: css`
    display: grid;
    gap: 20px;
    max-width: 1180px;
  `,
  section: css`
    display: grid;
    gap: 10px;
    padding-block: 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
}));
