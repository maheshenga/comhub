import { createStaticStyles } from 'antd-style';

export const sidebarStyles = createStaticStyles(({ css, cssVar }) => ({
  brand: css`
    display: flex;
    flex-direction: column;
    justify-content: center;

    min-width: 0;
    min-height: 64px;
    padding-block: 14px 10px;
    padding-inline: 16px;
  `,
  brandCaption: css`
    overflow: hidden;

    font-size: ${cssVar.fontSizeSM};
    line-height: ${cssVar.lineHeightSM};
    color: ${cssVar.colorTextTertiary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  brandTitle: css`
    font-size: ${cssVar.fontSizeLG};
    font-weight: ${cssVar.fontWeightStrong};
    line-height: 24px;
    color: ${cssVar.colorText};
  `,
  empty: css`
    padding-block: 24px;
    padding-inline: 16px;

    font-size: ${cssVar.fontSize};
    color: ${cssVar.colorTextSecondary};
    text-align: center;
  `,
  footer: css`
    padding-block: 10px 12px;
    padding-inline: 12px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
  footerButton: css`
    justify-content: flex-start;
    width: 100%;
  `,
  menu: css`
    border-inline-end: 0 !important;
    background: transparent !important;
  `,
  navigation: css`
    scrollbar-gutter: stable;
    overflow-y: auto;
    min-height: 0;
    padding-block-end: 8px;
  `,
  root: css`
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;

    width: 100%;
    height: 100%;
    min-height: 0;
  `,
  search: css`
    width: 100%;
    height: 34px;
    padding-block: 0;
    padding-inline: 34px 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusSM};

    font: inherit;
    color: ${cssVar.colorText};

    background: ${cssVar.colorBgContainer};
    outline: none;

    &::placeholder {
      color: ${cssVar.colorTextTertiary};
    }

    &:focus-visible {
      border-color: ${cssVar.colorPrimary};
      box-shadow: 0 0 0 2px ${cssVar.colorPrimaryBg};
    }
  `,
  searchIcon: css`
    pointer-events: none;

    position: absolute;
    inset-block-start: 9px;
    inset-inline-start: 10px;

    color: ${cssVar.colorTextTertiary};
  `,
  searchWrap: css`
    position: relative;
    margin-block: 0 10px;
    margin-inline: 12px;
  `,
}));
