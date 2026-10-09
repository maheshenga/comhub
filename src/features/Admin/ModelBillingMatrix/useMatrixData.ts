'use client';

import { useMemo } from 'react';

import { ADMIN_SETTINGS_SECTION_SWR_KEY } from '@/const/adminCacheKeys';
import {
  buildBillingBasisValues,
  buildMatrixRows,
  getDefaultModelHealth,
  getMatrixConfigHealth,
  getMatrixConfigHealthFocus,
} from '@/features/Admin/adminModelBillingMatrix';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import type { EnabledModelItem, PlanItem } from './shared';

export const MATRIX_KEY = ['admin-model-billing-matrix'];
export const PLANS_KEY = ['admin-plans'];

interface UseMatrixDataParams {
  canReadModels: boolean;
  canReadPlans: boolean;
  canReadSettings: boolean;
}

export const useMatrixData = ({
  canReadModels,
  canReadPlans,
  canReadSettings,
}: UseMatrixDataParams) => {
  const {
    data: modelData,
    error: modelError,
    isLoading: modelsLoading,
  } = useClientDataSWR(canReadModels ? MATRIX_KEY : null, () =>
    adminCommercialService.listAllEnabledAiProviderModels(),
  );
  const {
    data: planData,
    error: planError,
    isLoading: plansLoading,
  } = useClientDataSWR(canReadPlans ? PLANS_KEY : null, () => adminCommercialService.listPlans());
  const {
    data: settings,
    error: settingsError,
    isLoading: settingsLoading,
  } = useClientDataSWR(
    canReadSettings ? ADMIN_SETTINGS_SECTION_SWR_KEY('model-billing-matrix') : null,
    () => adminCommercialService.getSettingsSection('model-billing-matrix'),
  );

  const plans = useMemo(
    () =>
      ((planData?.items ?? []) as PlanItem[]).map((plan) => ({
        displayName: plan.displayName || plan.plan,
        plan: plan.plan,
      })),
    [planData?.items],
  );

  const sourceModels = useMemo(
    () =>
      ((modelData?.items ?? []) as EnabledModelItem[]).map((item) => ({
        displayName: item.displayName ?? null,
        groupKey: item.groupKey,
        groupName: item.groupName,
        hasModelAbilities: item.hasModelAbilities === true,
        hasModelPricing: item.hasModelPricing === true,
        instanceId: item.instanceId,
        instanceName: item.instanceName,
        modelId: item.modelId,
        modelType: item.modelType,
        pricingSource: item.pricingSource ?? undefined,
        priority: item.priority,
        providerType: item.providerType,
      })),
    [modelData?.items],
  );

  const baseRows = useMemo(
    () =>
      buildMatrixRows({
        defaultModel: settings?.defaultAgentModel,
        defaultModelsByType: {
          image: {
            model: settings?.defaultImageModel,
            provider: settings?.defaultImageProvider,
          },
          video: {
            model: settings?.defaultVideoModel,
            provider: settings?.defaultVideoProvider,
          },
        },
        defaultProvider: settings?.defaultAgentProvider,
        models: sourceModels,
        planRulesByPlan: Object.fromEntries(
          ((planData?.items ?? []) as PlanItem[]).map((plan) => [plan.plan, plan.modelRules]),
        ),
        plans,
        pricingRules: settings?.pricingModelRules ?? [],
      }),
    [planData?.items, plans, settings, sourceModels],
  );

  const loading =
    (canReadModels && modelsLoading) ||
    (canReadPlans && plansLoading) ||
    (canReadSettings && settingsLoading);
  const hasLoadError =
    (canReadModels && Boolean(modelError)) ||
    (canReadPlans && Boolean(planError)) ||
    (canReadSettings && Boolean(settingsError));
  const refreshMatrixData = () =>
    Promise.all([
      ...(canReadModels ? [mutate(MATRIX_KEY)] : []),
      ...(canReadPlans ? [mutate(PLANS_KEY)] : []),
      ...(canReadSettings
        ? [mutate(ADMIN_SETTINGS_SECTION_SWR_KEY('model-billing-matrix'))]
        : []),
    ]);
  const billingBasisInitial = useMemo(() => buildBillingBasisValues(settings), [settings]);
  const defaultModelHealth = useMemo(
    () =>
      getDefaultModelHealth(baseRows, {
        chat: {
          model: settings?.defaultAgentModel,
          provider: settings?.defaultAgentProvider,
        },
        image: {
          model: settings?.defaultImageModel,
          provider: settings?.defaultImageProvider,
        },
        video: {
          model: settings?.defaultVideoModel,
          provider: settings?.defaultVideoProvider,
        },
      }),
    [baseRows, settings],
  );

  return {
    baseRows,
    billingBasisInitial,
    defaultModelHealth,
    hasLoadError,
    loading,
    modelData,
    planData,
    plans,
    refreshMatrixData,
    settings,
  };
};

// Re-exported for the focus helper on the page.
export { getMatrixConfigHealth, getMatrixConfigHealthFocus };
