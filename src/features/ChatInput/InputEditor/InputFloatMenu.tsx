import { Block, Flexbox } from '@lobehub/ui';
import { css, cx } from 'antd-style';
import { memo, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const menuRootTopClassName = css`
  position: absolute;
  inset-block-start: -8px;
  inset-inline-start: 0;
  transform: translateY(-100%);
`;

const menuRootBottomClassName = css`
  position: absolute;
  z-index: 9999;
  inset-block-start: 100%;
  inset-inline-start: 0;

  padding-block-start: 8px;
`;

const menuContainerClassName = css`
  position: relative;
  overflow: hidden auto;
`;

type InputFloatMenuProps = {
  children?: ReactNode;
  className?: string;
  classNames?: {
    container?: string;
    root?: string;
  };
  getPopupContainer: () => HTMLDivElement | null;
  maxHeight?: number | string;
  open?: boolean;
  placement?: 'bottom' | 'top';
  style?: CSSProperties;
  styles?: {
    container?: CSSProperties;
    root?: CSSProperties;
  };
};

/**
 * Portal float menu used by the editor's autocomplete plugins (slash menu,
 * math preview). Anchored to the editor container so the popup is not clipped
 * by the editor's scroll/overflow context.
 */
const InputFloatMenu = memo<InputFloatMenuProps>(
  ({
    children,
    className,
    classNames,
    getPopupContainer,
    maxHeight = 'min(50vh, 640px)',
    open,
    placement = 'top',
    style,
    styles,
  }) => {
    const parent = getPopupContainer();
    if (!parent || !open) return null;

    return createPortal(
      <Flexbox
        className={cx(
          placement === 'bottom' ? menuRootBottomClassName : menuRootTopClassName,
          classNames?.root,
        )}
        paddingInline={8}
        style={styles?.root}
        width="100%"
      >
        <Block
          className={cx(menuContainerClassName, className, classNames?.container)}
          shadow
          style={{ maxHeight, ...style, ...styles?.container }}
          variant="outlined"
        >
          {children}
        </Block>
      </Flexbox>,
      parent,
    );
  },
);

InputFloatMenu.displayName = 'InputFloatMenu';

export default InputFloatMenu;
