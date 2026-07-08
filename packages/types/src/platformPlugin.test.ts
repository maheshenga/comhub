import { describe, expect, it } from 'vitest';

import {
  platformPluginActionConfigSchema,
  platformPluginAdminUpsertSchema,
  platformPluginBillingConfigSchema,
  platformPluginMarketplaceListInputSchema,
  platformPluginRuntimeTypeSchema,
  platformPluginOperationsMetadataSchema,
  platformPluginRunHistoryInputSchema,
} from './platformPlugin';

describe('platform plugin shared schemas', () => {
  it('accepts P1 runtime types only', () => {
    expect(platformPluginRuntimeTypeSchema.parse('api_action')).toBe('api_action');
    expect(platformPluginRuntimeTypeSchema.parse('content_generation')).toBe('content_generation');
    expect(() => platformPluginRuntimeTypeSchema.parse('mcp')).toThrow();
    expect(() => platformPluginRuntimeTypeSchema.parse('skill')).toThrow();
  });

  it('normalizes billing config defaults', () => {
    const value = platformPluginBillingConfigSchema.parse({});

    expect(value.defaultMultiplier).toBe(1);
    expect(value.fixedServiceFeeCredits).toBe(0);
    expect(value.externalApiCostCredits).toBe(0);
    expect(value.failureFixedFeePolicy).toBe('do_not_charge');
  });

  it('requires safe action identifiers and runtime type', () => {
    const value = platformPluginActionConfigSchema.parse({
      id: 'dictionary_lookup',
      inputSchema: {
        fields: [{ key: 'word', label: 'Word', required: true, type: 'text' }],
      },
      moduleMultiplier: 1.2,
      name: 'Dictionary Lookup',
      runtimeType: 'api_action',
    });

    expect(value.id).toBe('dictionary_lookup');
    expect(value.moduleMultiplier).toBe(1.2);
  });

  it.each([
    'file:///etc/passwd',
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://10.0.0.1',
    'http://172.16.0.1',
    'http://172.31.255.255',
    'http://192.168.1.1',
    'http://169.254.169.254',
    'http://[::1]',
    'http://[::ffff:7f00:1]',
    'http://[::ffff:a9fe:a9fe]',
    'http://[::ffff:0a00:0001]',
    'http://[::ffff:0808:0808]',
  ])('rejects unsafe api url %s', (url) => {
    expect(() =>
      platformPluginActionConfigSchema.parse({
        api: { url },
        id: 'dictionary_lookup',
        inputSchema: {
          fields: [{ key: 'word', label: 'Word', required: true, type: 'text' }],
        },
        name: 'Dictionary Lookup',
        runtimeType: 'api_action',
      })
    ).toThrow();
  });

  it('accepts a normal public https api url', () => {
    const publicUrl = 'https://example.com/api/v1/lookup?q=term';
    const value = platformPluginActionConfigSchema.parse({
      api: { url: publicUrl },
      id: 'dictionary_lookup',
      inputSchema: {
        fields: [{ key: 'word', label: 'Word', required: true, type: 'text' }],
      },
      name: 'Dictionary Lookup',
      runtimeType: 'api_action',
    });

    expect(value.api?.url).toBe(publicUrl);
  });

  it('validates admin upsert payloads', () => {
    const value = platformPluginAdminUpsertSchema.parse({
      billing: { defaultMultiplier: 1.35, fixedServiceFeeCredits: 10 },
      category: 'productivity',
      description: 'Generate structured research notes.',
      displayName: 'Research Notes',
      icon: 'FileText',
      runtimeType: 'content_generation',
      slug: 'research-notes',
      status: 'draft',
    });

    expect(value.slug).toBe('research-notes');
    expect(value.billing.defaultMultiplier).toBe(1.35);
  });

  it('defaults operations in admin upsert payloads', () => {
    const value = platformPluginAdminUpsertSchema.parse({
      billing: {},
      category: 'research',
      description: 'Generate research notes.',
      displayName: 'Research Notes',
      icon: 'FileText',
      runtimeType: 'content_generation',
      slug: 'research-notes',
      status: 'published',
      tags: ['research'],
    });

    expect(value.operations).toEqual({
      featured: false,
      sortWeight: 0,
    });
  });

  it('defaults and trims operations metadata', () => {
    expect(platformPluginOperationsMetadataSchema.parse(undefined)).toEqual({
      featured: false,
      sortWeight: 0,
    });
    expect(
      platformPluginOperationsMetadataSchema.parse({
        featured: true,
        planBenefitSummary: ' Pro benefit ',
        promoLabel: ' Hot ',
        sortWeight: '12',
        upgradeCta: ' Upgrade ',
        useCase: '',
      })
    ).toEqual({
      featured: true,
      planBenefitSummary: 'Pro benefit',
      promoLabel: 'Hot',
      sortWeight: 12,
      upgradeCta: 'Upgrade',
    });
  });

  it('accepts operations in admin upsert payloads', () => {
    const input = platformPluginAdminUpsertSchema.parse({
      billing: {},
      category: 'research',
      description: 'Generate research notes.',
      displayName: 'Research Notes',
      icon: 'FileText',
      operations: { featured: true, promoLabel: 'New', sortWeight: 20 },
      runtimeType: 'content_generation',
      slug: 'research-notes',
      status: 'published',
      tags: ['research'],
    });

    expect(input.operations).toEqual({ featured: true, promoLabel: 'New', sortWeight: 20 });
  });

  it('validates marketplace filters and run history pagination', () => {
    expect(platformPluginMarketplaceListInputSchema.parse({ query: ' notes ' })).toEqual({
      query: 'notes',
    });
    expect(
      platformPluginRunHistoryInputSchema.parse({
        pluginId: '00000000-0000-4000-8000-000000000001',
      })
    ).toEqual({
      cursor: 0,
      limit: 20,
      pluginId: '00000000-0000-4000-8000-000000000001',
    });
  });
});
