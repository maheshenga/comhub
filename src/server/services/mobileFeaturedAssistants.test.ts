import { describe, expect, it, vi } from 'vitest';

import type { MobileFeaturedAssistantV1 } from '@/const/mobileConfig';

import { resolveMobileFeaturedAssistants } from './mobileFeaturedAssistants';

const configured = (
  assistantId: string,
  order: number,
  overrides: Partial<MobileFeaturedAssistantV1> = {},
): MobileFeaturedAssistantV1 => ({
  assistantId,
  model: 'gpt-4.1',
  order,
  provider: 'openai',
  ...overrides,
});

describe('resolveMobileFeaturedAssistants', () => {
  it('preserves configured order and applies safe presentation overrides', async () => {
    const loadAssistant = vi.fn(async (identifier: string) => ({
      avatar: `${identifier}.png`,
      config: { systemRole: 'must not leak' },
      description: `${identifier} description`,
      identifier,
      status: 'published',
      title: `${identifier} title`,
    }));

    const result = await resolveMobileFeaturedAssistants({
      assistants: [
        configured('second', 2),
        configured('first', 1, {
          descriptionOverride: 'Curated description',
          titleOverride: 'Curated title',
        }),
      ],
      loadAssistant,
      models: [{ displayName: 'GPT 4.1', id: 'gpt-4.1', provider: 'openai' }],
    });

    expect(result).toEqual([
      {
        avatar: 'first.png',
        description: 'Curated description',
        identifier: 'first',
        model: { displayName: 'GPT 4.1', id: 'gpt-4.1', provider: 'openai' },
        title: 'Curated title',
      },
      {
        avatar: 'second.png',
        description: 'second description',
        identifier: 'second',
        model: { displayName: 'GPT 4.1', id: 'gpt-4.1', provider: 'openai' },
        title: 'second title',
      },
    ]);
    expect(result[0]).not.toHaveProperty('config');
  });

  it('skips stale, unpublished, inaccessible, and invalid-model entries and caps results at four', async () => {
    const loadAssistant = vi.fn(async (identifier: string) => {
      if (identifier === 'deleted') return;
      if (identifier === 'inaccessible') throw new Error('forbidden');
      return {
        description: identifier,
        identifier,
        status: identifier === 'draft' ? 'draft' : 'published',
        title: identifier,
      };
    });
    const assistants = [
      configured('deleted', 1),
      configured('draft', 2),
      configured('inaccessible', 3),
      configured('invalid-model', 4, { model: 'missing' }),
      ...Array.from({ length: 5 }, (_, index) => configured(`valid-${index + 1}`, index + 5)),
    ];

    const result = await resolveMobileFeaturedAssistants({
      assistants,
      loadAssistant,
      models: [{ displayName: 'GPT 4.1', id: 'gpt-4.1', provider: 'openai' }],
    });

    expect(result.map((item) => item.identifier)).toEqual([
      'valid-1',
      'valid-2',
      'valid-3',
      'valid-4',
    ]);
  });
});
