'use client';

import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Alert, Space, Tag, Typography } from 'antd';

import type { MatrixConfigHealthCheck } from '@/features/Admin/adminModelBillingMatrix';

import { CONFIG_HEALTH_CHECK_STATUS, CONFIG_HEALTH_STATUS } from './shared';

const { Text } = Typography;

interface ConfigHealthSectionProps {
  canFocusConfigHealthCheck: (check: MatrixConfigHealthCheck) => boolean;
  configHealth: {
    checks: MatrixConfigHealthCheck[];
    status: keyof typeof CONFIG_HEALTH_STATUS;
    summary: {
      databasePricingModelCount: number;
      defaultModelOkCount: number;
      defaultModelTotal: number;
      lobeHubOfficialPricingModelCount: number;
      missingAbilityModelCount: number;
      missingPricingModelCount: number;
      modelBankPricingModelCount: number;
      modelCount: number;
      planCount: number;
      pricingOverrideCount: number;
      providerPricingModelCount: number;
    };
  };
  focusedHealthCheckKey: string | null;
  onFocusConfigHealthCheck: (check: MatrixConfigHealthCheck) => void;
  t: (key: string, defaultValue?: string, values?: Record<string, unknown>) => string;
}

export const ConfigHealthSection = ({
  canFocusConfigHealthCheck,
  configHealth,
  focusedHealthCheckKey,
  onFocusConfigHealthCheck,
  t,
}: ConfigHealthSectionProps) => {
  const configHealthMeta = CONFIG_HEALTH_STATUS[configHealth.status];

  return (
    <Alert
      showIcon
      type={configHealthMeta.alertType as 'error' | 'success' | 'warning'}
      description={
        <Flexbox gap={10}>
          <Space wrap size={[8, 8]}>
            <Tag color={configHealthMeta.color}>{configHealthMeta.label}</Tag>
            <Tag>
              {t('admin.modelBillingMatrix.healthModels', 'Models')}: {configHealth.summary.modelCount}
            </Tag>
            <Tag>
              {t('admin.modelBillingMatrix.healthPlans', 'Plans')}: {configHealth.summary.planCount}
            </Tag>
            <Tag>
              {t('admin.modelBillingMatrix.healthDefaults', 'Defaults')}:{' '}
              {configHealth.summary.defaultModelOkCount}/{configHealth.summary.defaultModelTotal}
            </Tag>
            <Tag>
              {t('admin.modelBillingMatrix.healthPricingOverrides', 'Pricing overrides')}:{' '}
              {configHealth.summary.pricingOverrideCount}
            </Tag>
            <Tag>
              {t('admin.modelBillingMatrix.healthPricingFallbacks', 'Pricing metadata')}:{' '}
              {configHealth.summary.providerPricingModelCount}
            </Tag>
            <Tag>DB pricing: {configHealth.summary.databasePricingModelCount}</Tag>
            <Tag>LobeHub Official: {configHealth.summary.lobeHubOfficialPricingModelCount}</Tag>
            <Tag>Model Bank: {configHealth.summary.modelBankPricingModelCount}</Tag>
            <Tag>
              {t('admin.modelBillingMatrix.healthPricingMissing', 'Missing pricing')}:{' '}
              {configHealth.summary.missingPricingModelCount}
            </Tag>
            <Tag>
              {t('admin.modelBillingMatrix.healthAbilitiesMissing', 'Missing abilities')}:{' '}
              {configHealth.summary.missingAbilityModelCount}
            </Tag>
          </Space>

          <Flexbox gap={6}>
            {configHealth.checks.map((check) => {
              const meta = CONFIG_HEALTH_CHECK_STATUS[check.severity];

              return (
                <Space wrap align="start" key={check.key} size={6}>
                  <Tag color={meta.color}>{meta.label}</Tag>
                  <Text>{check.title}</Text>
                  {typeof check.count === 'number' ? <Tag>{check.count}</Tag> : null}
                  {check.detail ? <Text type="secondary">{check.detail}</Text> : null}
                  {canFocusConfigHealthCheck(check) ? (
                    <Button size="small" type="link" onClick={() => onFocusConfigHealthCheck(check)}>
                      {focusedHealthCheckKey === check.key ? '取消定位' : '定位'}
                    </Button>
                  ) : null}
                </Space>
              );
            })}
          </Flexbox>
        </Flexbox>
      }
      message={t(
        'admin.modelBillingMatrix.configHealthTitle',
        'Provider, model access, and billing configuration',
      )}
    />
  );
};

ConfigHealthSection.displayName = 'ConfigHealthSection';
