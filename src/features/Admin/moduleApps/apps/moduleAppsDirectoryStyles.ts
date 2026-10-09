'use client';

import { createStaticStyles, cssVar } from 'antd-style';

export const moduleAppsDirectoryStyles = createStaticStyles(({ css, cssVar }) => ({
  actions: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  control: css`
    display: grid;
    flex: 1 1 180px;
    gap: 6px;

    min-width: min(180px, 100%);

    font-size: 12px;
    line-height: 18px;
    color: ${cssVar.colorTextSecondary};
  `,
  controlWide: css`
    flex-basis: 240px;
  `,
  description: css`
    max-width: 720px;
    margin-block: 4px 0;
    margin-inline: 0;

    line-height: 22px;
    color: ${cssVar.colorTextSecondary};
  `,
  filterBar: css`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: end;

    padding-block: 16px;
    border-block: 1px solid ${cssVar.colorBorderSecondary};
  `,
  header: css`
    display: flex;
    flex-wrap: wrap;
    gap: 16px 24px;
    align-items: center;
    justify-content: space-between;
  `,
  heading: css`
    min-width: 0;

    h1 {
      margin: 0;

      font-size: 24px;
      font-weight: 600;
      line-height: 32px;
      color: ${cssVar.colorText};
      overflow-wrap: anywhere;
    }
  `,
  page: css`
    display: grid;
    gap: 20px;

    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 1180px;

    @media (width < 640px) {
      gap: 16px;
    }
  `,
  pagination: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;

    padding-block-start: 12px;
  `,
  tableFrame: css`
    overflow-x: auto;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorBgContainer};
  `,
  tableLink: css`
    cursor: pointer;

    overflow: hidden;
    display: inline-flex;

    max-width: min(360px, 100%);
    padding: 0;
    border: 0;

    font: inherit;
    font-weight: 500;
    color: ${cssVar.colorText};
    text-align: start;
    text-overflow: ellipsis;
    white-space: nowrap;

    background: transparent;

    &:hover {
      color: ${cssVar.colorPrimary};
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
    }
  `,
  tableShell: css`
    min-width: 0;
  `,
  table: css`
    border-collapse: collapse;
    width: 100%;
    min-width: 640px;

    th,
    td {
      padding-block: 12px;
      padding-inline: 16px;
      border-block-end: 1px solid ${cssVar.colorBorderSecondary};
      text-align: start;
    }

    th {
      font-size: 12px;
      font-weight: 500;
      line-height: 20px;
      color: ${cssVar.colorTextSecondary};

      background: ${cssVar.colorFillTertiary};
    }

    td {
      line-height: 22px;
      color: ${cssVar.colorTextSecondary};
    }

    tbody tr:last-child td {
      border-block-end: 0;
    }

    tbody tr:hover td {
      background: ${cssVar.colorFillTertiary};
    }

    @media (width < 640px) {
      th,
      td {
        padding-inline: 12px;
      }
    }
  `,
}));
