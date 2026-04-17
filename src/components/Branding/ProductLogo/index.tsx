'use client';

import { Flexbox } from '@lobehub/ui';
import { type LobeHubProps } from '@lobehub/ui/brand';
import { Authelia } from '@lobehub/ui/icons';
import { memo } from 'react';

import { useServerConfigStore } from '@/store/serverConfig';
import { siteConfigSelectors } from '@/store/serverConfig/selectors';

import CustomLogo from './Custom';

interface ProductLogoProps extends LobeHubProps {
  height?: number;
  width?: number;
}

const DefaultLogo = memo<ProductLogoProps>(
  ({ className, height, size, style, type, width, ...rest }) => {
    const siteTitle = useServerConfigStore(siteConfigSelectors.siteTitle);
    const logoSize = size ?? width ?? height ?? 32;
    const Title = (
      <Flexbox
        height={logoSize}
        style={{
          fontSize: logoSize / 1.5,
          fontWeight: 'bolder',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {siteTitle}
      </Flexbox>
    );

    if (type === 'text') {
      return (
        <Flexbox className={className} flex={'none'} style={style} {...rest}>
          {Title}
        </Flexbox>
      );
    }

    const Icon = type === 'mono' ? Authelia : Authelia.Color;

    if (type === 'combine') {
      return (
        <Flexbox
          align={'center'}
          className={className}
          flex={'none'}
          gap={Math.round(logoSize / 4)}
          horizontal
          style={style}
          {...rest}
        >
          <Icon size={logoSize} />
          {Title}
        </Flexbox>
      );
    }

    return (
      <Flexbox align={'center'} className={className} flex={'none'} style={style} {...rest}>
        <Icon size={logoSize} />
      </Flexbox>
    );
  },
);

export const ProductLogo = memo<ProductLogoProps>((props) => {
  const isCustomBranding = useServerConfigStore(siteConfigSelectors.isCustomBranding);

  if (isCustomBranding) {
    return <CustomLogo {...props} />;
  }

  return <DefaultLogo {...props} />;
});
