import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css }) => ({
  divider: css`
    height: 24px;
  `,

  // Inner container - dark mode
  innerContainerDark: css`
    position: relative;

    overflow: hidden;

    border: 1px solid #262626;
    border-radius: 8px;

    background: #080808;
  `,

  // Inner container - light mode
  innerContainerLight: css`
    position: relative;

    overflow: hidden;

    border: 1px solid #e3e3e3;
    border-radius: 8px;

    background: #fff;
  `,

  // Outer container
  outerContainer: css`
    position: relative;
  `,
}));
