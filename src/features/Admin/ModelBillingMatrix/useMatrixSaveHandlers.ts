'use client';

import { toast } from '@lobehub/ui/base-ui';
import { useState } from 'react';

import {
  type BillingBasisValues,
  buildBillingBasisUpdates,
  buildPlanModelRulesFromRows,
  buildPricingRulesFromRows,
  findFreePlanDefaultModelConflict,
  getPlanModelRulesSaveErrorMessage,
  type MatrixRow,
} from '@/features/Admin/adminModelBillingMatrix';
import { getAdminSettingsRefreshKeys, SETTING_KEYS } from '@/features/Admin/adminSettingsForm';
import { mutate } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { getDefaultModelErrorMessage, PLANS_KEY } from './shared';

interface UseMatrixSaveHandlersParams {
  baseRows: MatrixRow[];
  billingBasis: BillingBasisValues;
  billingBasisInitial: BillingBasisValues;
  canWriteFinance: boolean;
  canWriteSystem: boolean;
  modelData: Record<string, any> | undefined;
  planData: Record<string, any> | undefined;
  plans: { displayName: string; plan: string }[];
  rows: MatrixRow[];
  setBillingBasisOverride: (
    updater: BillingBasisValues | null | ((current: BillingBasisValues | null) => BillingBasisValues),
  ) => void;
  setRowsOverride: (updater: (current: MatrixRow[] | null) => MatrixRow[] | null) => void;
  settings: Record<string, any> | undefined;
  t: (key: any, defaultValue?: any, values?: any) => string;
}

export const useMatrixSaveHandlers = ({
  baseRows,
  billingBasis,
  billingBasisInitial,
  canWriteFinance,
  canWriteSystem,
  modelData,
  planData,
  plans,
  rows,
  settings,
  t,
  setBillingBasisOverride,
  setRowsOverride,
}: UseMatrixSaveHandlersParams) => {
  const [saving, setSaving] = useState(false);
  const [savingBillingBasis, setSavingBillingBasis] = useState(false);

  const updateRow = (rowKey: string, patch: Partial<MatrixRow>) => {
    setRowsOverride((current) =>
      (current ?? baseRows).map((row) => (row.key === rowKey ? { ...row, ...patch } : row)),
    );
  };

  const updateBillingBasis = (patch: Partial<BillingBasisValues>) => {
    setBillingBasisOverride((current: BillingBasisValues | null) => ({
      ...billingBasisInitial,
      ...current,
      ...patch,
    }));
  };
  const handleSaveBillingBasis = async () => {
    if (!canWriteSystem || !settings) return;

    const updates = buildBillingBasisUpdates(billingBasis, billingBasisInitial);

    if (updates.length === 0) {
      toast.info(t('admin.modelBillingMatrix.billingBasisNoChanges', '没有需要保存的变更'));
      return;
    }

    setSavingBillingBasis(true);

    try {
      await adminCommercialService.setAppSettingsBatch({ updates });
      setBillingBasisOverride(null);
      toast.success(t('admin.modelBillingMatrix.billingBasisSaved', '全局计费设置已保存'));
    } catch {
      toast.error(t('admin.modelBillingMatrix.billingBasisSaveFailed', '保存全局计费设置失败'));
    } finally {
      setSavingBillingBasis(false);
    }
  };

  const handleSetDefault = async (target: MatrixRow) => {
    if (!canWriteSystem || !modelData || !settings) return;

    if (['chat', 'image', 'video'].includes(target.modelType) && target.planAccess.free === false) {
      toast.error('该模型未对免费套餐开启，不能设为默认模型。请先开启免费套餐权限。');
      return;
    }

    setSaving(true);

    try {
      const updates =
        target.modelType === 'image'
          ? [
              { key: SETTING_KEYS.defaultImageProvider, value: target.provider },
              { key: SETTING_KEYS.defaultImageModel, value: target.modelId },
            ]
          : target.modelType === 'video'
            ? [
                { key: SETTING_KEYS.defaultVideoProvider, value: target.provider },
                { key: SETTING_KEYS.defaultVideoModel, value: target.modelId },
              ]
            : [
                { key: SETTING_KEYS.defaultAgentProvider, value: target.provider },
                { key: SETTING_KEYS.defaultAgentModel, value: target.modelId },
              ];

      await adminCommercialService.validateDefaultAgentSettings({
        model: target.modelId,
        modelType:
          target.modelType === 'image' || target.modelType === 'video' ? target.modelType : 'chat',
        provider: target.provider,
      });
      await adminCommercialService.setAppSettingsBatch({ updates });
      await Promise.all(getAdminSettingsRefreshKeys(updates).map((key) => mutate(key)));
      setRowsOverride((current) =>
        (current ?? baseRows).map((row) => ({
          ...row,
          isDefault: row.modelType === target.modelType ? row.key === target.key : row.isDefault,
        })),
      );
      toast.success(t('admin.modelBillingMatrix.defaultSaved', '默认模型已保存'));
    } catch (error: any) {
      toast.error(
        t('admin.modelBillingMatrix.defaultSaveFailed', getDefaultModelErrorMessage(error)),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccess = async () => {
    if (!canWriteFinance || !planData) return;

    const conflict = findFreePlanDefaultModelConflict(rows);
    if (conflict) {
      toast.error(
        `默认模型 ${conflict.displayName}（${conflict.provider}/${conflict.modelId}）已被免费套餐关闭，新注册用户将无法使用。请先开启免费套餐权限或更换默认模型。`,
      );
      return;
    }

    setSaving(true);

    try {
      const rulesByPlan = buildPlanModelRulesFromRows(rows, plans);
      await adminCommercialService.setPlanModelRulesBatch(
        Object.entries(rulesByPlan).map(([plan, modelRules]) => ({ modelRules, plan })),
      );
      await mutate(PLANS_KEY);
      toast.success(t('admin.modelBillingMatrix.accessSaved', '套餐模型权限已保存'));
    } catch (error) {
      toast.error(
        t('admin.modelBillingMatrix.accessSaveFailed', getPlanModelRulesSaveErrorMessage(error)),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSavePricing = async () => {
    if (!canWriteSystem || !settings) return;

    setSaving(true);

    try {
      await adminCommercialService.setAppSetting({
        key: SETTING_KEYS.pricingModelRules,
        value: buildPricingRulesFromRows(rows),
      });
      toast.success(t('admin.modelBillingMatrix.pricingSaved', '模型计费已保存'));
    } catch {
      toast.error(t('admin.modelBillingMatrix.pricingSaveFailed', '保存模型计费失败'));
    } finally {
      setSaving(false);
    }
  };

  return {
    handleSaveAccess,
    handleSaveBillingBasis,
    handleSavePricing,
    handleSetDefault,
    saving,
    savingBillingBasis,
    updateBillingBasis,
    updateRow,
  };
};
