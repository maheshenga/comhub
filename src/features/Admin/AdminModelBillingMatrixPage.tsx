'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Alert, Button } from '@lobehub/ui/base-ui';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MATRIX_NOTICE, MATRIX_SUBTITLE } from '@/features/Admin/adminMatrixCopy';
import {
  type BillingBasisValues,
  getMatrixConfigHealth,
  getMatrixConfigHealthFocus,
  type MatrixConfigHealthCheck,
  type MatrixRow,
  togglePlanAccess,
} from '@/features/Admin/adminModelBillingMatrix';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { AdminPageError, AdminPageShell, AdminSection } from './layout';
import { BillingBasisSection } from './ModelBillingMatrix/BillingBasisSection';
import { ConfigHealthSection } from './ModelBillingMatrix/ConfigHealthSection';
import { MatrixTable } from './ModelBillingMatrix/MatrixTable';
import { FILTERABLE_CONFIG_HEALTH_CHECKS } from './ModelBillingMatrix/shared';
import { useMatrixData } from './ModelBillingMatrix/useMatrixData';
import { useMatrixSaveHandlers } from './ModelBillingMatrix/useMatrixSaveHandlers';

const AdminModelBillingMatrixPage = memo(() => {
  const { t } = useTranslation('subscription');
  const role = useUserStore((state) => (userProfileSelectors.userProfile(state) as any)?.role);
  const canReadModels =
    hasAdminCapability(role, ADMIN_CAPABILITIES.modelOpsRead) ||
    hasAdminCapability(role, ADMIN_CAPABILITIES.financeRead) ||
    hasAdminCapability(role, ADMIN_CAPABILITIES.systemRead);
  const canReadPlans = hasAdminCapability(role, ADMIN_CAPABILITIES.financeRead);
  const canReadSettings = hasAdminCapability(role, ADMIN_CAPABILITIES.systemRead);
  const canWriteFinance = hasAdminCapability(role, ADMIN_CAPABILITIES.financeWrite);
  const canWriteSystem = hasAdminCapability(role, ADMIN_CAPABILITIES.systemWrite);
  const [billingBasisOverride, setBillingBasisOverride] = useState<BillingBasisValues | null>(null);
  const [focusedHealthCheckKey, setFocusedHealthCheckKey] = useState<string | null>(null);
  const [rowsOverride, setRowsOverride] = useState<MatrixRow[] | null>(null);

  const {
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
  } = useMatrixData({ canReadModels, canReadPlans, canReadSettings });

  const rows = rowsOverride ?? baseRows;
  const billingBasis = billingBasisOverride ?? billingBasisInitial;
  const hasDefaultModelRisk = Object.values(defaultModelHealth).some(
    (item) => item.status !== 'ok',
  );
  const configHealth = useMemo(
    () =>
      getMatrixConfigHealth({
        defaultModelHealth,
        globalPricingMultiplier: billingBasis.pricingMultiplier,
        plans,
        rows,
      }),
    [billingBasis.pricingMultiplier, defaultModelHealth, plans, rows],
  );
  const focusedHealthCheck = configHealth.checks.find(
    (check) => check.key === focusedHealthCheckKey,
  );
  const focusedHealthCheckFocus = useMemo(
    () =>
      focusedHealthCheck
        ? getMatrixConfigHealthFocus({
            checkKey: focusedHealthCheck.key,
            defaultModelHealth,
            plans,
            rows,
          })
        : null,
    [defaultModelHealth, focusedHealthCheck, plans, rows],
  );
  const focusedRowKeySet = useMemo(
    () => new Set(focusedHealthCheckFocus?.rowKeys ?? []),
    [focusedHealthCheckFocus?.rowKeys],
  );
  const focusedPlanKeySet = useMemo(
    () => new Set(focusedHealthCheckFocus?.planKeys ?? []),
    [focusedHealthCheckFocus?.planKeys],
  );
  const displayRows = focusedHealthCheck
    ? rows.filter((row) => focusedRowKeySet.has(row.key))
    : rows;
  const canFocusConfigHealthCheck = (check: MatrixConfigHealthCheck) =>
    FILTERABLE_CONFIG_HEALTH_CHECKS.has(check.key);
  const handleFocusConfigHealthCheck = (check: MatrixConfigHealthCheck) => {
    if (!canFocusConfigHealthCheck(check)) return;

    setFocusedHealthCheckKey((current) => (current === check.key ? null : check.key));
  };

  const {
    handleSaveAccess,
    handleSaveBillingBasis,
    handleSavePricing,
    handleSetDefault,
    saving,
    savingBillingBasis,
    updateBillingBasis,
    updateRow,
  } = useMatrixSaveHandlers({
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
    t: t as any,
    setBillingBasisOverride,
    setRowsOverride,
  });

  return (
    <AdminPageShell
      description={t('admin.modelBillingMatrix.subtitle', MATRIX_SUBTITLE)}
      title={t('admin.modelBillingMatrix.title', '模型与计费矩阵')}
      width="full"
    >
      <Flexbox gap={24}>
        <Alert showIcon message={t('admin.modelBillingMatrix.notice', MATRIX_NOTICE)} type="info" />

        {hasLoadError ? (
          <AdminPageError
            description={t(
              'admin.modelBillingMatrix.loadFailed',
              '部分模型、套餐或计费配置加载失败，请重试。',
            )}
            onRetry={refreshMatrixData}
          />
        ) : null}

        {canReadPlans && canReadSettings ? (
          <AdminSection
            description="检查服务商模型、套餐开放范围、默认模型和计费数据是否可以正常使用。"
            title={t('admin.modelBillingMatrix.configHealthSection', 'AI service health check')}
          >
            <ConfigHealthSection
              canFocusConfigHealthCheck={canFocusConfigHealthCheck}
              configHealth={configHealth}
              focusedHealthCheckKey={focusedHealthCheckKey}
              t={t as any}
              onFocusConfigHealthCheck={handleFocusConfigHealthCheck}
            />
          </AdminSection>
        ) : (
          <Alert
            showIcon
            type="info"
            message={t(
              'admin.modelBillingMatrix.scopedReadNotice',
              '当前仅显示此角色有权读取的模型、套餐或系统设置分区。',
            )}
          />
        )}

        {canReadSettings ? (
          <BillingBasisSection
            billingBasis={billingBasis}
            billingBasisOverride={Boolean(billingBasisOverride)}
            canWriteSystem={canWriteSystem}
            defaultModelHealth={defaultModelHealth}
            hasDefaultModelRisk={hasDefaultModelRisk}
            savingBillingBasis={savingBillingBasis}
            settings={settings}
            t={t as any}
            onDiscardBillingBasis={() => setBillingBasisOverride(null)}
            onSaveBillingBasis={() => void handleSaveBillingBasis()}
            onUpdateBillingBasis={updateBillingBasis}
          />
        ) : null}

        {focusedHealthCheck ? (
          <Alert
            showIcon
            description={`当前显示 ${displayRows.length}/${rows.length} 个相关模型。`}
            message={`已定位：${focusedHealthCheck.title}`}
            type="warning"
            action={
              <Button size="small" onClick={() => setFocusedHealthCheckKey(null)}>
                显示全部
              </Button>
            }
          />
        ) : null}

        <MatrixTable
          canReadPlans={canReadPlans}
          canReadSettings={canReadSettings}
          canWriteFinance={canWriteFinance}
          canWriteSystem={canWriteSystem}
          displayRows={displayRows}
          focusedPlanKeySet={focusedPlanKeySet}
          loading={loading}
          planData={planData}
          plans={plans}
          rows={rows}
          rowsOverride={rowsOverride}
          saving={saving}
          settings={settings}
          t={t as any}
          onDiscardRows={() => setRowsOverride(null)}
          onSaveAccess={() => void handleSaveAccess()}
          onSavePricing={() => void handleSavePricing()}
          onSetDefault={(row) => void handleSetDefault(row)}
          onUpdateRow={updateRow}
          onTogglePlanAccess={(current, rowKey, plan, checked) =>
            togglePlanAccess(current ?? baseRows, rowKey, plan, checked)
          }
        />
      </Flexbox>
    </AdminPageShell>
  );
});

AdminModelBillingMatrixPage.displayName = 'AdminModelBillingMatrixPage';

export default AdminModelBillingMatrixPage;
