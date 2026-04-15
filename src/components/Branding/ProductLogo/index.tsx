'use client';

import { type LobeHubProps } from '@lobehub/ui/brand';
import { LobeHub } from '@lobehub/ui/brand';
import { memo } from 'react';

import { useServerConfigStore } from '@/store/serverConfig';
import { siteConfigSelectors } from '@/store/serverConfig/selectors';

import CustomLogo from './Custom';

interface ProductLogoProps extends LobeHubProps {
  height?: number;
  width?: number;
}

export const ProductLogo = memo<ProductLogoProps>((props) => {
  const isCustomBranding = useServerConfigStore(siteConfigSelectors.isCustomBranding);

  if (isCustomBranding) {
    return <CustomLogo {...props} />;
  }

  return <LobeHub {...props} />;
});
