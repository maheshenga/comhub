import { describe, expect, it } from 'vitest';

import {
  platformPluginActionConfigSchema,
  platformPluginAdminUpsertSchema,
  platformPluginBillingConfigSchema,
  platformPluginRuntimeTypeSchema,
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
});
