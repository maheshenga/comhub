import { describe, expect, it } from 'vitest';

import { getProviderSpecificConfig } from './providerSpecificConfig';

describe('getProviderSpecificConfig', () => {
  it('should only pre-enable ComHub admin-managed NewAPI in business feature mode', () => {
    const providerConfig = getProviderSpecificConfig({
      enableBusinessFeatures: true,
      isDesktop: false,
    });

    expect(providerConfig.newapi.enabled).toBe(true);
    expect(providerConfig.lobehub).toBeUndefined();
    expect(providerConfig.deepseek.enabled).toBeUndefined();
    expect(providerConfig.ollama.fetchOnClient).toBe(true);
  });

  it('should keep upstream defaults outside business feature mode', () => {
    const providerConfig = getProviderSpecificConfig({
      enableBusinessFeatures: false,
      isDesktop: false,
    });

    expect(providerConfig.lobehub).toBeUndefined();
    expect(providerConfig.openai).toBeUndefined();
    expect(providerConfig.deepseek.enabled).toBe(true);
  });
});
