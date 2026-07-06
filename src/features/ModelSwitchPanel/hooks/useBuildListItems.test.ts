/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { type AiModelForSelect } from 'model-bank';
import { describe, expect, it } from 'vitest';

import { type EnabledProviderWithModels } from '@/types/aiProvider';

import { useBuildListItems } from './useBuildListItems';

const createModel = (id: string, displayName: string): AiModelForSelect => ({
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
      {
        modelId: 'gpt-4o',
        providerId: 'provider-a',
        type: 'provider-model-item',
      },
      {
        modelId: 'gpt-4o',
        providerId: 'provider-b',
        type: 'provider-model-item',
      },
    ]);
  });

  it('collapses duplicate models into one multi-provider row when grouped by model', () => {
    const { result } = renderHook(() => useBuildListItems(duplicateModelProviders, 'byModel'));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      data: {
        displayName: 'GPT-4o',
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
    });
  });

  it('keeps models with the same display name separate when their ids differ', () => {
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
});
