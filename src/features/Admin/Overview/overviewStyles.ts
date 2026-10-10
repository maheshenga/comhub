import { createStaticStyles } from 'antd-style';

/**
 * Workbench dashboard styles (ux-redesign-spec §5). Five-card grid + metric
 * band carded variants + quick-link strip; colors and type levels follow the
 * antd tokens referenced through adminDesignTokens roles.
 */
export const overviewStyles = createStaticStyles(({ css, cssVar }) => ({
  cardGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;

    @media (width < 1100px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (width < 760px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  chartEmpty: css`
    display: grid;
    place-items: center;

    min-height: 96px;
    border-radius: ${cssVar.borderRadiusSM};

    font-size: ${cssVar.fontSizeSM};
    color: ${cssVar.colorTextTertiary};
    text-align: center;

    background: ${cssVar.colorFillQuaternary};
  `,
  group: css`
    display: flex;
    flex-direction: column;
    gap: 10px;

    min-width: 0;
    padding-block: 14px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
  groupDescription: css`
    margin: 0;
    font-size: ${cssVar.fontSizeSM};
    line-height: ${cssVar.lineHeightSM};
    color: ${cssVar.colorTextSecondary};
  `,
  groupGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 24px;

    @media (width < 960px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (width < 640px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  groupTitle: css`
    margin: 0;

    font-size: ${cssVar.fontSize};
    font-weight: ${cssVar.fontWeightStrong};
    line-height: 22px;
    color: ${cssVar.colorText};
  `,
  keyValue: css`
    display: grid;
    grid-template-columns: minmax(100px, 1fr) minmax(0, 2fr);
    gap: 12px;
    align-items: baseline;

    min-height: 32px;
    padding-block: 5px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    &:last-child {
      border-block-end: 0;
    }
  `,
  keyValueLabel: css`
    color: ${cssVar.colorTextSecondary};
  `,
  keyValueValue: css`
    font-weight: ${cssVar.fontWeightStrong};
    color: ${cssVar.colorText};
    text-align: end;
    overflow-wrap: anywhere;
  `,
  link: css`
    cursor: pointer;

    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;

    width: 100%;
    min-height: 34px;
    padding-block: 5px;
    padding-inline: 8px;
    border: 0;
    border-radius: ${cssVar.borderRadiusSM};

    font: inherit;
    color: ${cssVar.colorText};
    text-align: start;

    background: transparent;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 1px;
    }
  `,
  linkList: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  metricCard: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  `,
  metricHero: css`
    display: flex;
    gap: 8px;
    align-items: baseline;

    font-family: ${cssVar.fontFamilyCode};
    font-size: ${cssVar.fontSizeHeading3};
    font-weight: ${cssVar.fontWeightStrong};
    line-height: 32px;
    color: ${cssVar.colorText};
  `,
  pending: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
    justify-content: center;

    min-height: 88px;
  `,
  split: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;

    @media (width < 800px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  stack: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  `,
}));
