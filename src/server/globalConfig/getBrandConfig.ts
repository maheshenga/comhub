import { BRANDING_LOGO_URL, BRANDING_NAME } from '@lobechat/business-const';

import { getPublicSiteConfig } from './getSiteConfig';

export interface RuntimeBrandConfig {
  brandLogoUrl: string;
  brandName: string;
  isCustomBranding: boolean;
  officialUrl: string;
  siteDescription: string;
  siteTitle: string;
}

/**
 * Load runtime brand configuration from the database, falling back to
 * compile-time constants when the DB is unavailable or fields are empty.
 *
 * This is intended for server-side usage (SSR metadata, manifests, etc.)
 * where React hooks are not available.
 */
export const getRuntimeBrandConfig = async (): Promise<RuntimeBrandConfig> => {
  const siteConfig = await getPublicSiteConfig();
  const brandLogoUrl = siteConfig.brand_logo_url || BRANDING_LOGO_URL;
  const brandName = siteConfig.brand_name || BRANDING_NAME;

  return {
    brandLogoUrl,
    brandName,
    isCustomBranding: brandName !== BRANDING_NAME || brandLogoUrl !== BRANDING_LOGO_URL,
    officialUrl: siteConfig.official_url || '',
    siteDescription: siteConfig.site_description || '',
    siteTitle: siteConfig.site_title || brandName,
  };
};
