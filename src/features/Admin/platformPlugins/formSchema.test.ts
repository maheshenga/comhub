import { describe, expect, it } from 'vitest';

import { buildPlatformPluginUpsertInput, normalizePlatformPluginFormValues } from './formSchema';

describe('platform plugin admin form schema', () => {
  it('normalizes editor values into an admin upsert payload', () => {
    const values = normalizePlatformPluginFormValues({
      category: 'productivity',
      defaultMultiplier: '1.35',
      description: 'Lookup a dictionary.',
      displayName: 'Dictionary Lookup',
      fixedServiceFeeCredits: '10',
      icon: 'BookOpen',
      runtimeType: 'api_action',
      slug: 'dictionary-lookup',
      status: 'draft',
    });

    const input = buildPlatformPluginUpsertInput(values);

    expect(input.billing.defaultMultiplier).toBe(1.35);
    expect(input.billing.fixedServiceFeeCredits).toBe(10);
    expect(input.runtimeType).toBe('api_action');
  });

  it('normalizes comma-separated tags and content generation fields', () => {
    const values = normalizePlatformPluginFormValues({
      artifactMimeType: 'text/markdown',
      artifactNameTemplate: 'research.md',
      category: 'research',
      defaultMultiplier: 2,
      description: 'Generate research notes.',
      displayName: 'Research Notes',
      icon: 'FileText',
      model: 'gpt-5-mini',
      promptTemplate: 'Write notes about {{topic}}',
      provider: 'openai',
      runtimeType: 'content_generation',
      slug: 'research-notes',
      status: 'published',
      tags: 'research, writing, research',
    });

    const input = buildPlatformPluginUpsertInput(values);

    expect(input.tags).toEqual(['research', 'writing']);
    expect(input.actionConfig?.runtimeType).toBe('content_generation');
    expect(input.actionConfig?.contentGeneration).toMatchObject({
      artifactMimeType: 'text/markdown',
      artifactNameTemplate: 'research.md',
      model: 'gpt-5-mini',
      provider: 'openai',
    });
  });
});
