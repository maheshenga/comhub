import type { AiProviderRuntimeState } from '@/types/aiProvider';

import { isModelAllowedByPlanRules, type PlanModelRuleType } from '@/business/server/planModelRules';
import type { PlanModelRules } from '@/database/schemas';

type RuntimeModel = AiProviderRuntimeState['enabledAiModels'][number] & {
  groupKey?: string | null;
  groupName?: string | null;
  instanceId?: string | null;
  instanceName?: string | null;
  providerType?: string | null;
};

export interface ModelVisibilityReason {
  code: 'disabled_by_plan_rule' | 'visible' | 'wrong_provider' | 'wrong_type';
  message: string;
}

export interface ModelCatalogEntry {
  groupKey?: string | null;
  groupName?: string | null;
  instanceId?: string | null;
  instanceName?: string | null;
  model: RuntimeModel;
  providerType?: string | null;
  visible: boolean;
  visibilityReason: ModelVisibilityReason;
}

export interface ResolveVisibleModelCatalogParams {
  modelType?: PlanModelRuleType;
  planRules?: PlanModelRules | null;
  providerId?: string;
  state: AiProviderRuntimeState;
}

const getModelType = (model: RuntimeModel) => model.type as PlanModelRuleType;

const resolveVisibilityReason = (
  model: RuntimeModel,
  params: Pick<ResolveVisibleModelCatalogParams, 'modelType' | 'planRules' | 'providerId'>,
): ModelVisibilityReason => {
  if (params.providerId && model.providerId !== params.providerId) {
    return { code: 'wrong_provider', message: 'Model belongs to a different AI provider.' };
  }

  if (params.modelType && getModelType(model) !== params.modelType) {
    return { code: 'wrong_type', message: 'Model type does not match this entry point.' };
  }

  const allowed = isModelAllowedByPlanRules(
    params.planRules,
    model.id,
    getModelType(model),
    model.groupKey,
  );

  if (!allowed) {
    return {
      code: 'disabled_by_plan_rule',
      message: 'Current plan rules do not allow this model.',
    };
  }

  return { code: 'visible', message: 'Model is enabled and visible for the current plan.' };
};

export const buildModelCatalog = (
  params: ResolveVisibleModelCatalogParams,
): ModelCatalogEntry[] => {
  return params.state.enabledAiModels.map((model) => {
    const runtimeModel = model as RuntimeModel;
    const visibilityReason = resolveVisibilityReason(runtimeModel, params);

    return {
      groupKey: runtimeModel.groupKey,
      groupName: runtimeModel.groupName,
      instanceId: runtimeModel.instanceId,
      instanceName: runtimeModel.instanceName,
      model: runtimeModel,
      providerType: runtimeModel.providerType,
      visible: visibilityReason.code === 'visible',
      visibilityReason,
    };
  });
};

const filterProvidersByModels = (
  providers: AiProviderRuntimeState['enabledAiProviders'],
  models: RuntimeModel[],
  modelType?: PlanModelRuleType,
) =>
  providers.filter((provider) =>
    models.some(
      (model) =>
        model.providerId === provider.id && (!modelType || getModelType(model) === modelType),
    ),
  );

export const resolveVisibleAiProviderRuntimeState = (
  params: ResolveVisibleModelCatalogParams,
): AiProviderRuntimeState => {
  const catalog = buildModelCatalog(params);
  const enabledAiModels = catalog.filter((entry) => entry.visible).map((entry) => entry.model);

  return {
    ...params.state,
    enabledAiModels,
    enabledAiProviders: filterProvidersByModels(params.state.enabledAiProviders, enabledAiModels),
    enabledChatAiProviders: filterProvidersByModels(
      params.state.enabledChatAiProviders,
      enabledAiModels,
      'chat',
    ),
    enabledImageAiProviders: filterProvidersByModels(
      params.state.enabledImageAiProviders,
      enabledAiModels,
      'image',
    ),
    enabledVideoAiProviders: filterProvidersByModels(
      params.state.enabledVideoAiProviders,
      enabledAiModels,
      'video',
    ),
  };
};

export const getModelCatalogHealth = (catalog: ModelCatalogEntry[]) => {
  const visibleCount = catalog.filter((entry) => entry.visible).length;
  const hiddenByPlanCount = catalog.filter(
    (entry) => entry.visibilityReason.code === 'disabled_by_plan_rule',
  ).length;
  const modelTypes = new Set(catalog.map((entry) => entry.model.type));

  return {
    hiddenByPlanCount,
    modelTypeCount: modelTypes.size,
    totalCount: catalog.length,
    visibleCount,
  };
};
