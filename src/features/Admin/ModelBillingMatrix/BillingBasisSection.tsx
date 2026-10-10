'use client';

import { DEFAULT_PRICING_CREDIT_MULTIPLIER } from '@lobechat/const/currency';
import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Tag } from '@lobehub/ui/base-ui';
import { InputNumber, Space, Switch, Typography } from 'antd';

import { MATRIX_DISCARD_LABEL } from '@/features/Admin/adminMatrixCopy';
import type { BillingBasisValues } from '@/features/Admin/adminModelBillingMatrix';
import { getAdminModelTypeLabel } from '@/features/Admin/adminModelTypeLabels';

import { DEFAULT_HEALTH_STATUS, getDefaultModelHealthMessage  } from './shared';

const { Text } = Typography;

interface BillingBasisSectionProps {
  billingBasis: BillingBasisValues;
  billingBasisOverride: boolean;
  canWriteSystem: boolean;
  defaultModelHealth: Record<
    string,
    {
      actualModelType?: string;
      model?: string | null;
      modelType: string;
      provider?: string | null;
      status: string;
    }
  >;
  hasDefaultModelRisk: boolean;
  onDiscardBillingBasis: () => void;
  onSaveBillingBasis: () => void;
  onUpdateBillingBasis: (patch: Partial<BillingBasisValues>) => void;
  savingBillingBasis: boolean;
  settings: Record<string, any> | undefined;
  t: (key: string, defaultValue?: string, values?: Record<string, unknown>) => string;
}

export const BillingBasisSection = ({
  billingBasis,
  billingBasisOverride,
  canWriteSystem,
  defaultModelHealth,
  hasDefaultModelRisk,
  onSaveBillingBasis,
  savingBillingBasis,
  settings,
  t,
  onDiscardBillingBasis,
  onUpdateBillingBasis,
}: BillingBasisSectionProps) => {
  const toFiniteNumber = (value: number | string | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

  return (
    <>
      <Alert
        showIcon
        message="默认模型健康检查"
        type={hasDefaultModelRisk ? 'warning' : 'success'}
        description={
          <Flexbox gap={8}>
            {Object.values(defaultModelHealth).map((health) => {
              const meta = DEFAULT_HEALTH_STATUS[health.status as keyof typeof DEFAULT_HEALTH_STATUS];

              return (
                <Space wrap align="start" key={health.modelType} size={6}>
                  <Tag color="blue">{getAdminModelTypeLabel(health.modelType as any)}</Tag>
                  <Text>
                    {health.model ? `${health.provider}/${health.model}` : `${health.provider}/未配置`}
                  </Text>
                  <Tag color={meta.color}>{meta.label}</Tag>
                  <Text type="secondary">{getDefaultModelHealthMessage(health)}</Text>
                </Space>
              );
            })}
          </Flexbox>
        }
      />

      <Alert
        showIcon
        message={t('admin.modelBillingMatrix.billingBasisSection', '全局计费基线')}
        type="info"
        description={
          <Text type="secondary">
            在线平台支付保持关闭；这里仅维护全局积分倍率，单模型倍率、每美元积分和套餐开放范围继续在矩阵中维护。
          </Text>
        }
      />
      <Flexbox gap={12}>
        <Text type="secondary">当前修改只影响后续计费计算，不会开启在线平台支付。</Text>

        <Space wrap align="start" size={24}>
          <Flexbox gap={8} style={{ minWidth: 220 }}>
            <Text strong>{t('admin.modelBillingMatrix.globalMultiplier', '全局积分倍率')}</Text>
            <InputNumber
              disabled={!canWriteSystem || !settings || savingBillingBasis}
              max={100}
              min={0.0001}
              precision={4}
              step={0.1}
              style={{ width: 180 }}
              value={billingBasis.pricingMultiplier}
              onChange={(next: number | null) =>
                onUpdateBillingBasis({
                  pricingMultiplier: toFiniteNumber(next) ?? DEFAULT_PRICING_CREDIT_MULTIPLIER,
                })
              }
            />
            <Text type="secondary">
              {t(
                'admin.modelBillingMatrix.globalMultiplierHelp',
                '用于生成计费的默认倍率，单模型倍率会覆盖该值。',
              )}
            </Text>
          </Flexbox>

          <Flexbox gap={8} style={{ minWidth: 220 }}>
            <Text strong>{t('admin.pricing.ordersEnabled', '在线平台支付（已关闭）')}</Text>
            <Switch
              disabled
              checked={false}
              checkedChildren={t('admin.modelBillingMatrix.enabled', '启用')}
              unCheckedChildren={t('admin.modelBillingMatrix.disabled', '停用')}
            />
            <Text type="secondary">
              {t(
                'admin.pricing.ordersEnabled.help',
                '平台在线支付保持关闭，仅兑换码充值可用；此状态不可在后台开启。',
              )}
            </Text>
          </Flexbox>
        </Space>

        <Space wrap>
          <Button
            disabled={!canWriteSystem || !settings}
            loading={savingBillingBasis}
            type="primary"
            onClick={onSaveBillingBasis}
          >
            {t('admin.modelBillingMatrix.saveBillingBasis', '保存全局计费设置')}
          </Button>
          {billingBasisOverride && (
            <Button disabled={savingBillingBasis} onClick={onDiscardBillingBasis}>
              {MATRIX_DISCARD_LABEL}
            </Button>
          )}
        </Space>
      </Flexbox>
    </>
  );
};

BillingBasisSection.displayName = 'BillingBasisSection';
