'use client';

import { Alert, Button, confirmModal, toast } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/validateFields/setFieldsValue）与 PlanEditModal 的受控表单契约绑定；base-ui Form 为非受控原生表单、base-ui/form 的 FormKit 是语义重写，均无法行为不变替换；FormKit 迁移另行立项。
import { Form } from 'antd';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import InlineTable from '@/components/InlineTable';
import { normalizePlanCatalogPresentation } from '@/const/billingPresentation';
import { toAdminAtomicCredits, toAdminDisplayCredits } from '@/features/Admin/adminCreditUnits';
import AdminDependencyImpactPreview from '@/features/Admin/AdminDependencyImpactPreview';
import AdminPlanFaqCard from '@/features/Admin/AdminPlanFaqCard';
import { ADMIN_PLAN_MODEL_MATRIX_PATH } from '@/features/Admin/adminPlanModelRules';
import {
  AdminPageError,
  AdminPageShell,
  AdminResponsiveTable,
  AdminSection,
  AdminToolbar,
} from '@/features/Admin/layout';
import { PlanEditModal } from '@/features/Admin/Plans/planEditModal';
import {
  ADMIN_PLANS_SWR_KEY,
  buildPlanColumns,
  type PlanFormValues,
  type PlanRow,
} from '@/features/Admin/Plans/shared';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const AdminPlansPage = memo(() => {
  const { t } = useTranslation('subscription');
  const navigate = useNavigate();
  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useClientDataSWR(ADMIN_PLANS_SWR_KEY, () => adminCommercialService.listPlans());
  const [editing, setEditing] = useState<Partial<PlanRow> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<PlanFormValues>();

  const items = (data?.items ?? []) as PlanRow[];

  const openEdit = (row?: PlanRow) => {
    const init = row ?? {
      currency: 'USD',
      displayName: '',
      features: [],
      isActive: true,
      monthlyCredits: 0,
      monthlyPrice: 0,
      metadata: {},
      plan: '',
      sortOrder: 0,
      yearlyPrice: 0,
    };

    setEditing(init);
    const metadata = init.metadata as PlanRow['metadata'];
    const presentation = normalizePlanCatalogPresentation(metadata);

    form.setFieldsValue({
      ...init,
      badge: presentation.badge,
      comparisonNote: presentation.comparisonNote,
      features: (init.features ?? []).join('\n'),
      lifetimePrice: metadata?.lifetimePrice ?? null,
      monthlyCredits: toAdminDisplayCredits(init.monthlyCredits),
      oneTimePrice: metadata?.oneTimePrice ?? null,
      pptCreditCost: Number(metadata?.pptCreditCost ?? 0),
      pptEnabled: metadata?.pptEnabled === true,
      pptMonthlyQuota: metadata?.pptMonthlyQuota ?? null,
      purchaseUrl: metadata?.purchaseUrl ?? '',
      storageQuotaMb: metadata?.storageQuotaMb ?? null,
      vectorQuota: metadata?.vectorQuota ?? null,
      yearlyDiscountLabel: presentation.yearlyDiscountLabel,
    } as PlanFormValues);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const features = String(values.features || '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);

      await adminCommercialService.upsertPlan({
        badge: values.badge?.trim() || undefined,
        comparisonNote: values.comparisonNote?.trim() || undefined,
        currency: values.currency || 'USD',
        displayName: values.displayName,
        features,
        isActive: !!values.isActive,
        lifetimePrice:
          values.lifetimePrice === null || values.lifetimePrice === undefined
            ? null
            : Number(values.lifetimePrice),
        monthlyCredits: toAdminAtomicCredits(values.monthlyCredits),
        monthlyPrice: Number(values.monthlyPrice || 0),
        oneTimePrice:
          values.oneTimePrice === null || values.oneTimePrice === undefined
            ? null
            : Number(values.oneTimePrice),
        plan: values.plan,
        pptCreditCost: Number(values.pptCreditCost || 0),
        pptEnabled: values.pptEnabled === true,
        pptMonthlyQuota:
          values.pptMonthlyQuota === null || values.pptMonthlyQuota === undefined
            ? null
            : Number(values.pptMonthlyQuota),
        purchaseUrl: values.purchaseUrl?.trim() || undefined,
        sortOrder: Number(values.sortOrder || 0),
        storageQuotaMb:
          values.storageQuotaMb === null || values.storageQuotaMb === undefined
            ? null
            : Number(values.storageQuotaMb),
        vectorQuota:
          values.vectorQuota === null || values.vectorQuota === undefined
            ? null
            : Number(values.vectorQuota),
        yearlyDiscountLabel: values.yearlyDiscountLabel?.trim() || undefined,
        yearlyPrice: Number(values.yearlyPrice || 0),
      });
      toast.success(t('admin.plans.saveSuccess', '套餐已保存'));
      setEditing(null);
      await mutate(ADMIN_PLANS_SWR_KEY);
    } catch {
      toast.error(t('admin.plans.saveFailed', '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (plan: string) => {
    const impact = await adminCommercialService.getPlanDeleteImpact(plan);

    confirmModal({
      content: <AdminDependencyImpactPreview impact={impact} />,
      okButtonProps: { danger: true, disabled: !impact.canProceed },
      onOk: async () => {
        await adminCommercialService.deletePlan(plan);
        toast.success(t('admin.plans.deleted', '套餐已删除'));
        await mutate(ADMIN_PLANS_SWR_KEY);
      },
      title: t('admin.plans.confirmDelete', '确认删除套餐？'),
    });
  };

  const handleToggleActive = async (row: PlanRow) => {
    await adminCommercialService.setPlanActive({ isActive: !row.isActive, plan: row.plan });
    await mutate(ADMIN_PLANS_SWR_KEY);
  };

  const columns = buildPlanColumns(t as any, {
    handleDelete: (plan) => {
      void handleDelete(plan);
    },
    handleToggleActive: (row) => {
      void handleToggleActive(row);
    },
    navigate,
    openEdit,
  });

  return (
    <AdminPageShell
      description={t('admin.plans.description', '维护订阅套餐的价格、积分、权益和展示信息。')}
      title={t('admin.plans.title', '套餐管理')}
      width="full"
    >
      <AdminSection>
        <Alert
          showIcon
          type="info"
          action={
            <Button size="small" onClick={() => navigate(ADMIN_PLAN_MODEL_MATRIX_PATH)}>
              打开矩阵
            </Button>
          }
          message={t(
            'admin.plans.modelRulesMoved',
            '套餐模型权限已统一移动到“模型与计费矩阵”。此页只维护套餐价格、积分和权益，避免同一权限在多个入口重复编辑。',
          )}
        />

        <AdminToolbar>
          <Button disabled={isLoading || Boolean(error)} type="primary" onClick={() => openEdit()}>
            {t('admin.plans.create', '新建套餐')}
          </Button>
        </AdminToolbar>

        {error ? (
          <AdminPageError
            description={t('admin.plans.loadFailed', '套餐加载失败，请重试。')}
            onRetry={refresh}
          />
        ) : !isLoading && items.length === 0 ? (
          <AdminResponsiveTable label={t('admin.plans.tableLabel', '套餐配置表')}>
            <InlineTable
              columns={columns as any}
              dataSource={[]}
              loading={false}
              locale={{ emptyText: t('admin.plans.empty', '暂无套餐配置') }}
              rowKey="plan"
            />
          </AdminResponsiveTable>
        ) : (
          <AdminResponsiveTable label={t('admin.plans.tableLabel', '套餐配置表')}>
            <InlineTable
              columns={columns as any}
              dataSource={items}
              loading={isLoading}
              rowKey="plan"
            />
          </AdminResponsiveTable>
        )}
      </AdminSection>

      <AdminSection title={t('admin.plans.faqTitle', '套餐配置说明')}>
        <AdminPlanFaqCard />
      </AdminSection>

      <PlanEditModal
        editing={editing}
        form={form}
        submitting={submitting}
        t={t as any}
        onCancel={() => setEditing(null)}
        onSave={handleSave}
      />
    </AdminPageShell>
  );
});

AdminPlansPage.displayName = 'AdminPlansPage';

export default AdminPlansPage;
