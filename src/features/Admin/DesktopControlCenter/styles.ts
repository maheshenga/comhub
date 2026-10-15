import { createStaticStyles, cssVar } from 'antd-style';

export const desktopControlCenterStyles = createStaticStyles(({ css }) => ({
  assetGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;

    padding-block: 12px;
    padding-inline: 0;
  `,
  buildProfileActions: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  `,
  buildProfileHeader: css`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  `,
  buildProfileLayout: css`
    display: flex;
    flex-direction: column;
    gap: 24px;
  `,
  buildProfileSelectorLabel: css`
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
  channelGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
  // 分区间距对齐 AdminSection 的 gap 约定（16px），不再与壳内其它分区
  // 出现 12px/16px 的差异。
  channelSection: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  formActions: css`
    display: flex;
    justify-content: flex-end;
    padding-block-start: 8px;
  `,
  formSection: css`
    width: min(100%, 1040px);
  `,
  platformSummary: css`
    overflow: hidden;

    min-height: 88px;
    padding: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  sectionTitle: css`
    margin: 0 !important;

    /* 基线是 antd Typography.Title level=4（fontSizeHeading4=20px、
       fontWeightStrong=600、标题行高 token）；base-ui Text 的 h4 variant 是
       fontSize*1.25≈17.5px + font-weight:bold(700) + line-height:1.25，逐项
       补齐 token 保持视觉不变（对齐 TopUpPurchase 的 fontSize={20} 先例）。 */
    font-size: ${cssVar.fontSizeHeading4};
    font-weight: ${cssVar.fontWeightStrong};
    line-height: ${cssVar.lineHeightHeading4};
  `,
  tabs: css`
    min-width: 0;

    .ant-tabs-content-holder,
    .ant-tabs-content,
    .ant-tabs-tabpane {
      min-width: 0;
    }
  `,
  truncate: css`
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));
