import { BRANDING_LOGO_URL, BRANDING_NAME } from '@lobechat/business-const';

import { type ServerConfigStore } from './store';

export const featureFlagsSelectors = (s: ServerConfigStore) => s.featureFlags;

const getBrandLogoUrl = (s: ServerConfigStore) =>
  s.serverConfig.siteConfig?.brand_logo_url || BRANDING_LOGO_URL;

const getBrandName = (s: ServerConfigStore) => s.serverConfig.siteConfig?.brand_name || BRANDING_NAME;

const getSiteTitle = (s: ServerConfigStore) => s.serverConfig.siteConfig?.site_title || getBrandName(s);

const isCustomBranding = (s: ServerConfigStore) =>
  getBrandName(s) !== BRANDING_NAME || getBrandLogoUrl(s) !== BRANDING_LOGO_URL;

export const siteConfigSelectors = {
  brandLogoUrl: getBrandLogoUrl,
  brandName: getBrandName,
  hasCustomSiteIdentity: (s: ServerConfigStore) =>
    isCustomBranding(s) || getSiteTitle(s) !== getBrandName(s),
  isCustomBranding,
  officialUrl: (s: ServerConfigStore) => s.serverConfig.siteConfig?.official_url || '',
  siteDescription: (s: ServerConfigStore) => s.serverConfig.siteConfig?.site_description || '',
  siteTitle: getSiteTitle,
};

export const serverConfigSelectors = {
  disableEmailPassword: (s: ServerConfigStore) => s.serverConfig.disableEmailPassword || false,
  enableBusinessFeatures: (s: ServerConfigStore) => s.serverConfig.enableBusinessFeatures || false,
  enableEmailVerification: (s: ServerConfigStore) =>
    s.serverConfig.enableEmailVerification || false,
  enableKlavis: (s: ServerConfigStore) => s.serverConfig.enableKlavis || false,
  enableLobehubSkill: (s: ServerConfigStore) => s.serverConfig.enableLobehubSkill || false,
  enableMagicLink: (s: ServerConfigStore) => s.serverConfig.enableMagicLink || false,
  enableMarketTrustedClient: (s: ServerConfigStore) =>
    s.serverConfig.enableMarketTrustedClient || false,
  enableUploadFileToServer: (s: ServerConfigStore) => s.serverConfig.enableUploadFileToServer,
  enabledTelemetryChat: (s: ServerConfigStore) => s.serverConfig.telemetry.langfuse || false,
  isMobile: (s: ServerConfigStore) => s.isMobile || false,
  oAuthSSOProviders: (s: ServerConfigStore) => s.serverConfig.oAuthSSOProviders,
};
