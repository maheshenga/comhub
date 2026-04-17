import { describe, expect, it } from 'vitest';

import { DEFAULT_FEATURE_FLAGS, mapFeatureFlagsEnvToState } from '@/config/featureFlags';

import { featureFlagsSelectors, serverConfigSelectors, siteConfigSelectors } from './selectors';
import { initServerConfigStore } from './store';

describe('featureFlagsSelectors', () => {
  it('should return feature flags from store', () => {
    const store = initServerConfigStore({
      featureFlags: {
        ...mapFeatureFlagsEnvToState(DEFAULT_FEATURE_FLAGS),
        isAgentEditable: false,
        showProvider: true,
        showMarket: true,
        showAiImage: true,
      },
    });

    const result = featureFlagsSelectors(store.getState());

    expect(result.isAgentEditable).toBe(false);
    expect(result.showProvider).toBe(true);
    expect(result.showMarket).toBe(true);
    expect(result.showAiImage).toBe(true);
  });
});

describe('serverConfigSelectors', () => {
  describe('enabledTelemetryChat', () => {
    it('should return langfuse value from store when defined', () => {
      const store = initServerConfigStore({
        serverConfig: {
          telemetry: { langfuse: true },
          aiProvider: {},
        },
      });

      const result = serverConfigSelectors.enabledTelemetryChat(store.getState());

      expect(result).toBe(true);
    });

    it('should return false when langfuse is not defined', () => {
      const store = initServerConfigStore({
        serverConfig: {
          telemetry: {},
          aiProvider: {},
        },
      });

      const result = serverConfigSelectors.enabledTelemetryChat(store.getState());

      expect(result).toBe(false);
    });
  });
});

describe('siteConfigSelectors', () => {
  it('should fall back to brand name when site title is empty', () => {
    const store = initServerConfigStore({
      serverConfig: {
        aiProvider: {},
        siteConfig: {
          brand_name: 'ComHub',
        },
        telemetry: {},
      },
    });

    expect(siteConfigSelectors.siteTitle(store.getState())).toBe('ComHub');
  });

  it('should treat a custom logo url as custom branding', () => {
    const store = initServerConfigStore({
      serverConfig: {
        aiProvider: {},
        siteConfig: {
          brand_logo_url: 'https://example.com/logo.png',
        },
        telemetry: {},
      },
    });

    expect(siteConfigSelectors.isCustomBranding(store.getState())).toBe(true);
  });

  it('should detect a custom site title even when brand name is unchanged', () => {
    const store = initServerConfigStore({
      serverConfig: {
        aiProvider: {},
        siteConfig: {
          site_title: 'ComHub Workspace',
        },
        telemetry: {},
      },
    });

    expect(siteConfigSelectors.hasCustomSiteIdentity(store.getState())).toBe(true);
  });
});
