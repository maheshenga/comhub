/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import type { AiModelForSelect } from 'model-bank';
import { describe, expect, it } from 'vitest';

import type { EnabledProviderWithModels } from '@/types/aiProvider';

import { buildListItems, useBuildListItems } from './useBuildListItems';

const createModel = (id: string, displayName = id): AiModelForSelect => ({
  abilities: {
    functionCall: true,
    reasoning: false,
    vision: true,
  },
  displayName,
  id,
});

const createProvider = (
  id: string,
  name: string,
  children: AiModelForSelect[],
): EnabledProviderWithModels => ({
  children,
  id,
  name,
  source: 'builtin',
});

const getProviderModelIds = (items: ReturnType<typeof buildListItems>) =>
  items.flatMap((item) => (item.type === 'provider-model-item' ? [item.model.id] : []));

describe('useBuildListItems', () => {
  const duplicateModelProviders = [
    createProvider('provider-a', 'Provider A', [createModel('gpt-4o', 'GPT-4o')]),
    createProvider('provider-b', 'Provider B', [createModel('gpt-4o', 'GPT-4o')]),
  ];

  it('keeps duplicate provider model rows when grouped by provider', () => {
    const { result } = renderHook(() => useBuildListItems(duplicateModelProviders, 'byProvider'));

    const modelItems = result.current.filter((item) => item.type === 'provider-model-item');

    expect(modelItems).toHaveLength(2);
    expect(
      modelItems.map((item) => ({
        modelId: item.model.id,
        providerId: item.provider.id,
        type: item.type,
      })),
    ).toEqual([
      { modelId: 'gpt-4o', providerId: 'provider-a', type: 'provider-model-item' },
      { modelId: 'gpt-4o', providerId: 'provider-b', type: 'provider-model-item' },
    ]);
  });

  it('collapses the same model ID into one multi-provider row', () => {
    const { result } = renderHook(() => useBuildListItems(duplicateModelProviders, 'byModel'));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      data: {
        displayName: 'GPT-4o',
        providers: [
          { id: 'provider-a', name: 'Provider A' },
          { id: 'provider-b', name: 'Provider B' },
        ],
      },
      type: 'model-item-multiple',
    });
  });

  it('keeps models with the same display name separate when their IDs differ', () => {
    const { result } = renderHook(() =>
      useBuildListItems(
        [
          createProvider('provider-a', 'Provider A', [
            createModel('chat-model-a', 'Chat Model'),
            createModel('chat-model-b', 'Chat Model'),
          ]),
        ],
        'byModel',
      ),
    );

    expect(
      result.current.map((item) =>
        item.type === 'model-item-single' || item.type === 'model-item-multiple'
          ? item.data.model.id
          : item.type,
      ),
    ).toEqual(['chat-model-a', 'chat-model-b']);
  });

  it('stably moves matching models after other models within a provider', () => {
    const items = buildListItems(
      [
        createProvider('lobehub', 'LobeHub', [
          createModel('pro-a'),
          createModel('normal-a'),
          createModel('pro-b'),
          createModel('normal-b'),
        ]),
      ],
      'byProvider',
      '',
      (modelId, providerId) => providerId === 'lobehub' && modelId.startsWith('pro-'),
    );

    expect(getProviderModelIds(items)).toEqual(['normal-a', 'normal-b', 'pro-a', 'pro-b']);
  });

  it('does not move a by-model row when another provider remains available', () => {
    const items = buildListItems(
      [
        createProvider('lobehub', 'LobeHub', [
          createModel('mixed-pro', 'Mixed'),
          createModel('lobehub-pro'),
          createModel('normal'),
        ]),
        createProvider('openai', 'OpenAI', [createModel('mixed-pro', 'Mixed')]),
      ],
      'byModel',
      '',
      (modelId, providerId) => providerId === 'lobehub' && modelId.includes('pro'),
    );

    expect(
      items.flatMap((item) =>
        item.type === 'model-item-single' || item.type === 'model-item-multiple'
          ? [item.data.model.id]
          : [],
      ),
    ).toEqual(['mixed-pro', 'normal', 'lobehub-pro']);
  });
});
