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

  // Runtime-configured brand logo (admin Settings → Brand) takes precedence
  // over build-time CUSTOM_BRANDING. Only override when a logo URL is set.
  if (brand.logoUrl) {
    return (
      <img
        alt={brand.name || 'logo'}
        height={props.height}
        src={brand.logoUrl}
        style={{ height: props.height, width: props.width, ...((props as any).style ?? {}) }}
        width={props.width}
      />
    );
  }

  if (isCustomBranding) {
    return <CustomLogo {...props} />;
  }

  return <LobeHub {...props} />;
});
