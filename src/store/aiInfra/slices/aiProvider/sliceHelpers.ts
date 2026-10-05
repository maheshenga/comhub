import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import { getModelPropertyWithFallback } from '@lobechat/model-runtime/getModelPropertyWithFallback';
import type { AiFullModelCard, EnabledAiModel, ModelAbilities } from 'model-bank';
import { DEFAULT_MODEL_PROVIDER_LIST } from 'model-bank/modelProviders';

import { AiProviderSourceEnum } from '@/types/aiProvider';

/**
 * ComHub helpers for the aiProvider store slice.
 *
 * Upstream `action.ts` keeps its slice shape; the fork-specific pieces live
 * here: the lazy service import (importing `@/services/aiProvider` eagerly
 * creates an aiInfra -> user -> services -> aiInfra circular dependency),
 * the catalog fallbacks that fill abilities/context window for
 * admin-managed NewAPI models, and the business-mode offline provider list
 * (empty in business mode because providers come from the server runtime
 * state, not the static provider table).
 */

export const getAiProviderService = async () =>
  (await import('@/services/aiProvider')).aiProviderService;

export const resolveChatModelCatalogFallbacks = async (
  model: EnabledAiModel,
  getInlineModelProperty: <T>(
    model: EnabledAiModel,
    propertyName: keyof AiFullModelCard,
  ) => Promise<T | undefined>,
) => {
  const abilitiesPromise = Object.keys(model.abilities ?? {}).length
    ? Promise.resolve(model.abilities)
    : getModelPropertyWithFallback<ModelAbilities | undefined>(
        model.id,
        'abilities',
        model.providerId,
      );

  // contextWindowTokens stays inline-first: touching the catalog fallback for
  // it would fire catalog lookups for models that carry the value inline.
  const [abilities, contextWindowTokens] = await Promise.all([
    abilitiesPromise,
    getInlineModelProperty<number>(model, 'contextWindowTokens'),
  ]);

  return {
    abilities: (abilities || {}) as ModelAbilities,
    contextWindowTokens,
  };
};

export const resolveOfflineEnabledProviders = () =>
  (ENABLE_BUSINESS_FEATURES ? [] : DEFAULT_MODEL_PROVIDER_LIST)
    .filter((provider) => provider.enabled)
    .map((item) => ({ id: item.id, name: item.name, source: AiProviderSourceEnum.Builtin }));

export const getModelProperty = async <T>(
  model: EnabledAiModel,
  propertyName: keyof AiFullModelCard,
): Promise<T | undefined> => {
  const inlineValue = (model as Partial<AiFullModelCard>)[propertyName];
  if (inlineValue !== undefined) return inlineValue as T;

  return getModelPropertyWithFallback<T | undefined>(model.id, propertyName, model.providerId);
};
