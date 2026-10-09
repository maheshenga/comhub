'use client';

import { createStaticStyles } from 'antd-style';

import { MOBILE_TABBAR_HEIGHT } from '@/const/layoutTokens';

export const previewStyles = createStaticStyles(({ css, cssVar }) => ({
  appCell: css`
    display: grid;
    gap: 8px;
    place-items: center;

    min-width: 0;
    min-height: 104px;
    padding-block: 8px;
    padding-inline: 0;

    font-size: 13px;
    line-height: 18px;
    text-align: center;
  `,
  appIcon: css`
    display: grid;
    place-items: center;

    width: 44px;
    height: 44px;
    border-radius: 8px;

    color: ${cssVar.colorPrimary};

    background: ${cssVar.colorFillSecondary};
  `,
  appLabel: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;

    max-width: 100%;
    min-height: 36px;

    font-size: 13px;
    line-height: 18px;
    text-align: center;
  `,
  designCell: css`
    display: grid;
    gap: 6px;
    place-items: center;

    min-width: 0;
    min-height: 88px;
    padding-block: 8px;
    padding-inline: 4px;

    font-size: 13px;
    line-height: 18px;
    text-align: center;
  `,
  designLabel: css`
    overflow: hidden;

    max-width: 100%;

    font-size: 13px;
    line-height: 18px;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  assistantAvatar: css`
    display: grid;
    place-items: center;

    width: 44px;
    height: 44px;
    border-radius: 8px;

    font-size: 15px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillSecondary};
  `,
  assistantMeta: css`
    overflow: hidden;

    font-size: 12px;
    line-height: 18px;
    color: ${cssVar.colorTextTertiary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  assistantName: css`
    overflow: hidden;

    font-size: 15px;
    font-weight: 600;
    line-height: 22px;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  assistantRow: css`
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) minmax(72px, auto);
    gap: 12px;
    align-items: center;

    min-height: 76px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  assistantText: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,
  brand: css`
    overflow: hidden;

    font-size: 16px;
    font-weight: 600;
    line-height: 22px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  brandLogo: css`
    width: 28px;
    height: 28px;
    border-radius: 6px;
    object-fit: contain;
  `,
  content: css`
    overflow: auto;
    flex: 1;
    padding: 12px;
    background: ${cssVar.colorBgLayout};
  `,
  frame: css`
    overflow: hidden;
    display: flex;
    flex-direction: column;

    width: 100%;
    min-width: 280px;
    max-width: 360px;
    min-height: 560px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    background: ${cssVar.colorBgContainer};
    box-shadow: ${cssVar.boxShadowSecondary};
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  `,
  appGrid: css`
    grid-auto-rows: 104px;
  `,
  header: css`
    display: flex;
    flex: 0 0 ${MOBILE_TABBAR_HEIGHT}px;
    gap: 8px;
    align-items: center;

    min-height: ${MOBILE_TABBAR_HEIGHT}px;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  label: css`
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  nav: css`
    display: grid;
    flex: 0 0 ${MOBILE_TABBAR_HEIGHT}px;
    min-height: ${MOBILE_TABBAR_HEIGHT}px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
  navIcon: css`
    display: grid;
    place-items: center;
    height: 22px;
  `,
  navItem: css`
    display: grid;
    grid-template-rows: 22px 16px;
    gap: 2px;
    place-items: center;

    min-width: 0;
    height: ${MOBILE_TABBAR_HEIGHT}px;
    min-height: 44px;
    padding-block: 4px;
    padding-inline: 2px;
    border: 0;

    font-size: 11px;
    line-height: 16px;
    color: ${cssVar.colorTextSecondary};

    background: transparent;

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: -2px;
    }

    &:not(:disabled) {
      cursor: pointer;
    }
  `,
  navItemActive: css`
    color: ${cssVar.colorPrimary};

    svg {
      fill: color-mix(in srgb, ${cssVar.colorPrimary} 24%, transparent);
    }
  `,
  preview: css`
    display: flex;
    flex-direction: column;
    gap: 12px;

    width: 100%;
    max-width: 360px;
  `,
  recentAvatar: css`
    display: grid;
    place-items: center;

    width: 40px;
    height: 40px;
    border-radius: 8px;

    font-size: 13px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillSecondary};
  `,
  recentMeta: css`
    font-size: 12px;
    line-height: 18px;
    color: ${cssVar.colorTextTertiary};
  `,
  recentRow: css`
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
    gap: 12px;
    align-items: center;

    min-height: 64px;
    padding-block: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  recentText: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,
  recentTitle: css`
    overflow: hidden;

    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  section: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-block-end: 16px;
  `,
  sectionHeader: css`
    display: flex;
    align-items: center;
    min-height: 44px;
  `,
  sectionTitle: css`
    margin: 0;

    font-size: 16px;
    font-weight: 600;
    line-height: 22px;
    color: ${cssVar.colorText};
  `,
}));

