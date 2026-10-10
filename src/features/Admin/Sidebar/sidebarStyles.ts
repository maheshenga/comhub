import { createStaticStyles } from 'antd-style';

/**
 * Sidebar styles (ux-redesign-spec §2). Visual upgrade of the four-row grid
 * (brand / search / navigation / footer); group separation, header captions
 * and collapsed mode are new, while the structural roles stay untouched.
 */
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

    /* Group headers (ux-redesign-spec §2.2): uppercase caption style with the
       item count as a tertiary mini badge on the right. */
    .admin-nav-group-count {
      min-width: 20px;
      padding-block: 0;
      padding-inline: 6px;
      border-radius: ${cssVar.borderRadiusSM};

      font-size: ${cssVar.fontSizeSM};
      font-weight: ${cssVar.fontWeightStrong};
      line-height: 18px;
      color: ${cssVar.colorTextTertiary};
      text-align: center;

      background: ${cssVar.colorFillQuaternary};
    }

    /* Submenu titles render as group headers: caption-flavored. */
    .ant-menu-submenu-title {
      letter-spacing: 0.02em;
    }

    /* Selected entry: primary text on primary bg; the 3px rounded accent bar
       comes from ConfigProvider itemSelectedBg/itemSelectedColor at the Admin
       layout root (spec §2.2.2 path ①) — this block only adds the bar. */
    .ant-menu-item.ant-menu-item-selected {
      position: relative;
    }

    .ant-menu-item.ant-menu-item-selected::before {
      position: absolute;
      inset-block: 6px;
      inset-inline-start: 0;

      width: 3px;
      border-radius: 2px;

      content: '';

      background: ${cssVar.colorPrimary};
    }

    /* Group separation: 8px rhythm + hairline divider between submenus. */
    .ant-menu-submenu:not(:first-child) {
      margin-block-start: 8px;
    }

    .ant-menu-submenu:not(:last-child) {
      border-block-end: 1px solid ${cssVar.colorSplit};
      padding-block-end: 4px;
    }
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
