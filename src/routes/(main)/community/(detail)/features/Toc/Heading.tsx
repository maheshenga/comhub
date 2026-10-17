'use client';

import { Icon } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { kebabCase } from 'es-toolkit/compat';
import { Heading2, Heading3, Heading4, Heading5 } from 'lucide-react';
import { type ComponentProps, type FC, type ReactNode } from 'react';
import { isValidElement, useEffect, useMemo } from 'react';

import { useToc } from './useToc';

const extractTextChildren = (children: ReactNode): string => {
  // 与 Children.forEach 等价的纯递归展开（项目禁用 Children 迭代 API）。
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractTextChildren).join('');
  if (isValidElement(children)) {
    return extractTextChildren((children.props as { children?: ReactNode }).children);
  }
  return '';
};

const HeadingIcon: any = {
  h2: Heading2,
  h3: Heading3,
  h4: Heading4,
  h5: Heading5,
};

const styles = createStaticStyles(({ cx, css, cssVar }) => ({
  anchor: cx(
    'toc-anchor',
    css`
      display: none;
      margin-inline-start: 0.5rem;
      color: ${cssVar.colorTextDescription} !important;
    `,
  ),
  container: css`
    &:hover {
      .toc-anchor {
        display: inline;
      }
    }
  `,
}));

const createHeading = (Tag: `h${1 | 2 | 3 | 4 | 5 | 6}`) => {
  const Heading: FC<ComponentProps<'h2'>> = ({ children, className, style, ...props }) => {
    const { setToc, setFinished } = useToc();
    const text = useMemo(() => extractTextChildren(children), [children]);
    const id = kebabCase(text);

    useEffect(() => {
      if (!setToc) return;
      if (Tag === 'h2' || Tag === 'h3') {
        setToc?.((prev = []) => [
          ...prev,
          {
            href: `#${id}`,
            level: Tag === 'h2' ? 2 : 3,
            title: text,
          },
        ]);
      }
      setFinished();
      // setToc/setFinished 来自 TocContext，每次 Provider 渲染都是新引用；且 effect 内
      // setToc 是追加语义（...prev），text 变化时重跑会重复注册同一标题。
      // 注册只随 id（kebab 后的锚点）变化执行一次。
      // eslint-disable-next-line react-hooks/exhaustive-deps -- context callbacks are unstable per render and re-running would append duplicate TOC entries
    }, [id]);

    if (Tag === 'h1')
      return (
        <Tag style={{ color: cssVar.colorText, ...style }} {...props} id={id}>
          {children}
        </Tag>
      );

    return (
      <Tag
        className={cx(styles.container, className)}
        style={{ color: cssVar.colorText, ...style }}
        {...props}
        id={id}
      >
        {children}
        <a
          aria-label="Permalink for this section"
          className={styles.anchor}
          href={`#${id}`}
          style={{ scrollMarginTop: 96 }}
        >
          <Icon icon={HeadingIcon[Tag]} />
        </a>
      </Tag>
    );
  };

  return Heading;
};

export const H1 = createHeading('h1');
export const H2 = createHeading('h2');
export const H3 = createHeading('h3');
export const H4 = createHeading('h4');
export const H5 = createHeading('h5');
