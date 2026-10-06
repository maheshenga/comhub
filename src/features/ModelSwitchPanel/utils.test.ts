import { USD_TO_CNY } from '@lobechat/const/currency';
import { type Pricing } from 'model-bank';
import { describe, expect, it } from 'vitest';

import { type ListItem } from './types';
import { formatPriceMultiplier, getInputPriceMultiplier, getListItemKey } from './utils';

describe('getInputPriceMultiplier', () => {
  it('uses the USD input rate per 1M tokens as the multiplier', () => {
    const pricing = {
      units: [
        { name: 'textInput', rate: 3, strategy: 'fixed', unit: 'millionTokens' },
        { name: 'textOutput', rate: 15, strategy: 'fixed', unit: 'millionTokens' },
      ],
    } as Pricing;

    expect(getInputPriceMultiplier(pricing)).toBe(3);
  });

  it('converts CNY pricing to USD', () => {
    const pricing = {
      currency: 'CNY',
      units: [
        { name: 'textInput', rate: USD_TO_CNY * 2, strategy: 'fixed', unit: 'millionTokens' },
      ],
    } as Pricing;

    expect(getInputPriceMultiplier(pricing)).toBeCloseTo(2);
  });

  it('uses the first tier of tiered pricing', () => {
    const pricing = {
      units: [
        {
          name: 'textInput',
          strategy: 'tiered',
          tiers: [
            { rate: 1.25, upTo: 200_000 },
            { rate: 2.5, upTo: 'infinity' },
          ],
          unit: 'millionTokens',
        },
      ],
    } as Pricing;

    expect(getInputPriceMultiplier(pricing)).toBe(1.25);
  });

  it('keeps free models at 0', () => {
    const pricing = {
      units: [{ name: 'textInput', rate: 0, strategy: 'fixed', unit: 'millionTokens' }],
    } as Pricing;

    expect(getInputPriceMultiplier(pricing)).toBe(0);
  });

  it('returns undefined without a text input price', () => {
    expect(getInputPriceMultiplier(undefined)).toBeUndefined();
    expect(
      getInputPriceMultiplier({
        units: [{ name: 'imageGeneration', rate: 0.04, strategy: 'fixed', unit: 'image' }],
      } as Pricing),
    ).toBeUndefined();
  });
});

describe('formatPriceMultiplier', () => {
  it.each([
    [0.0125, '0.013'],
    [0.05, '0.05'],
    [0.3, '0.3'],
    [1, '1'],
    [1.25, '1.25'],
    [2.555, '2.56'],
    [15, '15'],
    [37.5, '38'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatPriceMultiplier(input)).toBe(expected);
  });
});

describe('getListItemKey', () => {
  it('includes provider ids in grouped model item keys', () => {
    const item: ListItem = {
      data: {
        displayName: 'GPT-4o',
        model: {
          abilities: {
            functionCall: true,
            reasoning: false,
            vision: true,
          },
          displayName: 'GPT-4o',
          id: 'gpt-4o',
        },
        providers: [
          {
            id: 'provider-a',
            name: 'Provider A',
          },
          {
            id: 'provider-b',
            name: 'Provider B',
          },
        ],
      },
      type: 'model-item-multiple',
    };

    expect(getListItemKey(item)).toBe('model:gpt-4o:GPT-4o:provider-a,provider-b');
  });

  it('uses model id to avoid collisions between equal grouped display names', () => {
    const createGroupedItem = (id: string): ListItem => ({
      data: {
        displayName: 'Chat Model',
        model: {
          abilities: {
            functionCall: true,
            reasoning: false,
            vision: true,
          },
          displayName: 'Chat Model',
          id,
        },
        providers: [
          {
            id: 'provider-a',
            name: 'Provider A',
          },
        ],
      },
      type: 'model-item-single',
    });

    expect(getListItemKey(createGroupedItem('chat-model-a'))).not.toBe(
      getListItemKey(createGroupedItem('chat-model-b')),
    );
  });

  it('keeps provider model item keys provider scoped', () => {
    const item: ListItem = {
      model: {
        abilities: {
          functionCall: true,
          reasoning: false,
          vision: true,
        },
        displayName: 'GPT-4o',
        id: 'gpt-4o',
      },
      provider: {
        children: [],
        id: 'provider-a',
        name: 'Provider A',
        source: 'builtin',
      },
      type: 'provider-model-item',
    };

    expect(getListItemKey(item)).toBe('provider-a-gpt-4o');
  });
});
