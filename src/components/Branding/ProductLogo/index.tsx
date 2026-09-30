'use client';

import { type LobeHubProps } from '@lobehub/ui/brand';
import { LobeHub } from '@lobehub/ui/brand';
import { type CSSProperties, memo } from 'react';

import { isCustomBranding } from '@/const/version';
import { useRuntimeBrand } from '@/features/Brand/useRuntimeBrand';

import CustomLogo from './Custom';

interface ProductLogoProps extends LobeHubProps {
  color?: string;
  height?: number;
  size?: number;
  style?: CSSProperties;
  type?: '3d' | 'combine' | 'flat' | 'mono' | 'text';
  width?: number;
}

export const ProductLogo = memo<ProductLogoProps>((props) => {
  // ComHub logo resolution (runtime brand → build-time custom → upstream)
  // lives in features/Brand/useRuntimeBrand; this upstream component only
  // threads the hook and renders the chosen branch.
  const { logoUrl, name } = useRuntimeBrand();
  const logoHeight = props.height ?? props.size;
  const logoWidth = props.width ?? props.size;

  if (logoUrl) {
    return (
      <img
        alt={name || 'logo'}
        height={logoHeight}
        src={logoUrl}
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
