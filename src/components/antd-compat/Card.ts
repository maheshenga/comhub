// keep-antd 豁免（原 no-restricted-imports 行内豁免已随升级失效，保留原因）：antd Card shim: neither @lobehub/ui nor @lobehub/ui/base-ui ships a Card; business settings pages render this wrapper until a Card equivalent is designed, and consumers pass antd CardProps (cover/bordered/hoverable) with no compatible substitute.
import { Card as AntdCard, type CardProps } from 'antd';
import { createElement, type ReactElement } from 'react';

export const Card = (props: CardProps): ReactElement => createElement(AntdCard as any, props);

export type { CardProps };
