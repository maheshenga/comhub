import { createStaticStyles, cssVar } from 'antd-style';

import { adminDesignStyles } from '../layout/adminDesignTokens';

export const mobileSettingsStyles = createStaticStyles(({ css }) => ({
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  `,
  itemRow: css`
    display: grid;
    grid-template-columns: minmax(130px, 1fr) minmax(130px, 1fr) minmax(140px, 1fr) auto auto;
    gap: 8px;
    align-items: end;

    padding-block: 10px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    @media (width <= 900px) {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    @media (width <= 560px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  orderedEntry: css`
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;

    min-height: 40px;
    padding-block: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  // 分区容器间距与 AdminSection 一致（gap: 16px）；此处保留私有 section
  // 是因为各分区把 aria-label 挂在 <section> 上提供 region 地标语义
  // （AdminMobileSettingsPage.test.tsx 按 region name 查询），而 AdminSection
  // 不接受 aria-label。
  section: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  sectionTitle: css`
    margin: 0;
    /* 标题规格复用共享令牌（fontSizeLG / fontWeightStrong / line-height: 24px），
       与 AdminSection 的 sectionTitle 同源。 */
    ${adminDesignStyles.sectionTitle}
  `,
}));
