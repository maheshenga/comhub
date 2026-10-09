'use client';

import { createStaticStyles, cssVar } from 'antd-style';

export const adminPageStyles = createStaticStyles(({ css, cssVar }) => ({
  actions: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;

    @media (width < 640px) {
      justify-content: flex-start;
      width: 100%;
    }
  `,
  description: css`
    max-width: 760px;
    margin: 0;

    font-size: ${cssVar.fontSize};
    line-height: ${cssVar.lineHeight};
    color: ${cssVar.colorTextSecondary};
  `,
  formActions: css`
    position: sticky;
    z-index: 3;
    inset-block-end: 0;

    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;

    margin-inline: -24px;
    padding-block: 12px;
    padding-inline: 24px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};

    background: color-mix(in srgb, ${cssVar.colorBgContainer} 94%, transparent);
    backdrop-filter: blur(12px);
    box-shadow: 0 -4px 16px rgb(0 0 0 / 6%);

    @media (width < 640px) {
      justify-content: stretch;
      margin-inline: -16px;
      padding-inline: 16px;

      > * {
        flex: 1;
      }
    }
  `,
  formGrid: css`
    display: grid;
    gap: 0 16px;
    min-width: 0;

    > * {
      min-width: 0;
    }
  `,
  formGridTwo: css`
    grid-template-columns: repeat(2, minmax(0, 1fr));

    @media (width < 640px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  formGridThree: css`
    grid-template-columns: repeat(3, minmax(0, 1fr));

    @media (width < 900px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (width < 640px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  header: css`
    display: flex;
    gap: 20px;
    align-items: flex-start;
    justify-content: space-between;

    @media (width < 640px) {
      flex-direction: column;
      gap: 12px;
    }
  `,
  headerText: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  `,
  metric: css`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 10px 12px;
    align-content: center;

    box-sizing: border-box;
    min-width: 0;
    min-height: 104px;
    padding: 16px;
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};

    &:first-of-type {
      border-inline-start: 0;
    }

    @media (width < 900px) {
      &:nth-of-type(odd) {
        border-inline-start: 0;
      }

      &:nth-of-type(n + 3) {
        border-block-start: 1px solid ${cssVar.colorBorderSecondary};
      }
    }

    @media (width < 560px) {
      min-height: 92px;
      border-block-start: 1px solid ${cssVar.colorBorderSecondary};
      border-inline-start: 0;

      &:first-of-type {
        border-block-start: 0;
      }
    }
  `,
  metricHint: css`
    overflow: hidden;

    font-size: ${cssVar.fontSizeSM};
    line-height: ${cssVar.lineHeightSM};
    color: ${cssVar.colorTextTertiary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  metricIcon: css`
    display: grid;
    grid-row: 1 / span 3;
    place-items: center;

    width: 32px;
    height: 32px;
    border-radius: ${cssVar.borderRadiusSM};

    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillSecondary};
  `,
  metricLabel: css`
    font-size: ${cssVar.fontSizeSM};
    line-height: ${cssVar.lineHeightSM};
    color: ${cssVar.colorTextSecondary};
  `,
  metrics: css`
    overflow: hidden;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-block: 1px solid ${cssVar.colorBorderSecondary};

    @media (width < 900px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (width < 560px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  metricValue: css`
    overflow: hidden;

    font-family: ${cssVar.fontFamilyCode};
    font-size: ${cssVar.fontSizeXL};
    font-weight: ${cssVar.fontWeightStrong};
    line-height: 28px;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  page: css`
    display: flex;
    flex-direction: column;
    gap: 24px;

    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    margin-inline: auto;
    padding: 24px;

    @media (width < 640px) {
      gap: 20px;
      padding: 16px;
    }
  `,
  pageFull: css`
    max-width: none;
  `,
  pageLarge: css`
    max-width: 1280px;
  `,
  pageMedium: css`
    max-width: 1040px;
  `,
  pageSmall: css`
    max-width: 800px;
  `,
  responsiveTable: css`
    scrollbar-gutter: stable;

    overflow-x: auto;
    overscroll-behavior-inline: contain;

    width: 100%;
    min-width: 0;
  `,
  section: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  `,
  sectionDescription: css`
    margin-block: 2px 0;
    margin-inline: 0;

    font-size: ${cssVar.fontSize};
    line-height: ${cssVar.lineHeight};
    color: ${cssVar.colorTextSecondary};
  `,
  sectionHeader: css`
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;

    padding-block-end: 10px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    @media (width < 640px) {
      flex-direction: column;
      gap: 10px;
    }
  `,
  sectionTitle: css`
    margin: 0;

    font-size: ${cssVar.fontSizeLG};
    font-weight: ${cssVar.fontWeightStrong};
    line-height: 24px;
    color: ${cssVar.colorText};
  `,
  title: css`
    margin: 0;

    font-size: ${cssVar.fontSizeHeading3};
    font-weight: ${cssVar.fontWeightStrong};
    line-height: 32px;
    color: ${cssVar.colorText};
    letter-spacing: 0;

    @media (width < 640px) {
      font-size: ${cssVar.fontSizeHeading4};
      line-height: 28px;
    }
  `,
  toolbar: css`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;

    min-height: 44px;
    padding-block: 8px;
    border-block: 1px solid ${cssVar.colorBorderSecondary};
  `,
  toolbarSticky: css`
    position: sticky;
    z-index: 5;
    inset-block-start: 0;

    background: color-mix(in srgb, ${cssVar.colorBgLayout} 92%, transparent);
    backdrop-filter: blur(12px);
  `,
}));
