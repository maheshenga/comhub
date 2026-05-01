'use client';

import { Alert, Button, Descriptions, Input, Tag, message } from 'antd';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from '@lobehub/ui';

import { redemptionService } from '@/services/redemption';

interface PreviewState {
  creditsAmount: number | null;
  found: boolean;
  planCycle: string | null;
  planDurationMonths: number | null;
  planKey: string | null;
  rewardType: 'plan' | 'credits' | 'topup_package' | null;
  status: string | null;
  topupPackageId: string | null;
}

const RedemptionPanel = memo<{ onSuccess?: () => void }>(({ onSuccess }) => {
  const { t } = useTranslation('subscription');
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    try {
      const r = (await redemptionService.preview(trimmed)) as any;
      if (!r.found) {
        setPreview({ found: false } as any);
      } else {
        setPreview({
          creditsAmount: r.creditsAmount ?? null,
          found: true,
          planCycle: r.planCycle ?? null,
          planDurationMonths: r.planDurationMonths ?? null,
          planKey: r.planKey ?? null,
          rewardType: r.rewardType ?? null,
          status: r.status ?? null,
          topupPackageId: r.topupPackageId ?? null,
        });
      }
    } catch {
      message.error(t('billing.redeem.previewFailed', 'Preview failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    try {
      const r = await redemptionService.redeem(trimmed);
      message.success(
        t('billing.redeem.success', `Redeemed: ${r.reward}`),
      );
      setCode('');
      setPreview(null);
      onSuccess?.();
    } catch (err: any) {
      const msg = err?.message ?? '';
      const errorMap: Record<string, string> = {
        CODE_ALREADY_REDEEMED: t('billing.redeem.alreadyRedeemed', 'Already redeemed'),
        CODE_DISABLED: t('billing.redeem.disabled', 'Code disabled'),
        CODE_EXPIRED: t('billing.redeem.expired', 'Code expired'),
        CODE_NOT_FOUND: t('billing.redeem.notFound', 'Code not found'),
        CODE_RACE: t('billing.redeem.race', 'Code already taken'),
      };
      const matched = Object.keys(errorMap).find((k) => msg.includes(k));
      message.error(matched ? errorMap[matched] : t('billing.redeem.failed', 'Redemption failed'));
    } finally {
      setLoading(false);
    }
  };

  const canRedeem = preview?.found && preview.status === 'active';

  return (
    <Flexbox gap={12}>
      <Flexbox align="center" gap={8} horizontal>
        <Input
          onChange={(e) => {
            setCode(e.target.value);
            setPreview(null);
          }}
          onPressEnter={handleCheck}
          placeholder={t('billing.redeem.placeholder', 'Enter redemption code')}
          style={{ maxWidth: 360 }}
          value={code}
        />
        <Button loading={loading} onClick={handleCheck}>
          {t('billing.redeem.check', 'Check')}
        </Button>
        <Button
          disabled={!canRedeem}
          loading={loading}
          onClick={handleRedeem}
          type="primary"
        >
          {t('billing.redeem.redeem', 'Redeem')}
        </Button>
      </Flexbox>

      {preview && !preview.found && (
        <Alert
          message={t('billing.redeem.notFound', 'Code not found')}
          showIcon
          type="error"
        />
      )}
      {preview?.found && (
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label={t('billing.redeem.type', 'Reward Type')}>
            <Tag color="blue">{preview.rewardType}</Tag>
          </Descriptions.Item>
          {preview.rewardType === 'plan' && (
            <Descriptions.Item label={t('billing.redeem.plan', 'Plan')}>
              {preview.planKey} · {preview.planCycle}
              {preview.planDurationMonths ? ` · ${preview.planDurationMonths}m` : ''}
            </Descriptions.Item>
          )}
          {preview.rewardType === 'credits' && (
            <Descriptions.Item label={t('billing.redeem.credits', 'Credits')}>
              {preview.creditsAmount}
            </Descriptions.Item>
          )}
          {preview.rewardType === 'topup_package' && (
            <Descriptions.Item label={t('billing.redeem.package', 'Package')}>
              {preview.topupPackageId}
            </Descriptions.Item>
          )}
          <Descriptions.Item label={t('billing.redeem.status', 'Status')}>
            <Tag
              color={
                preview.status === 'active'
                  ? 'green'
                  : preview.status === 'redeemed'
                    ? 'blue'
                    : preview.status === 'expired'
                      ? 'orange'
                      : 'default'
              }
            >
              {preview.status}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      )}
    </Flexbox>
  );
});

RedemptionPanel.displayName = 'RedemptionPanel';

export default RedemptionPanel;
