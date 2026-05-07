'use client';

import { type LobeHubProps } from '@lobehub/ui/brand';
import { LobeHub } from '@lobehub/ui/brand';
import { memo } from 'react';

import { isCustomBranding } from '@/const/version';
import { useBrand } from '@/features/Brand';

import CustomLogo from './Custom';

interface ProductLogoProps extends LobeHubProps {
  height?: number;
  width?: number;
}

export const ProductLogo = memo<ProductLogoProps>((props) => {
  const brand = useBrand();
  const logoHeight = props.height ?? props.size;
  const logoWidth = props.width ?? props.size;

  // Runtime-configured brand logo takes precedence over build-time CUSTOM_BRANDING.
  if (brand.logoUrl) {
    return (
      <img
        alt={brand.name || 'logo'}
        height={logoHeight}
        src={brand.logoUrl}
        style={{ height: logoHeight, objectFit: 'contain', width: logoWidth, ...props.style }}
        width={logoWidth}
      />
    );
  }

  if (isCustomBranding) {
    return <CustomLogo {...props} />;
  }

  return <LobeHub {...props} />;
});
