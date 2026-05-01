'use client';

import { FormGroup } from '@lobehub/ui';
import { type TableColumnType } from 'antd';
import { Button, Empty, Input, message } from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { mutate, useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { commercialService } from '@/services/commercial';
import { type ReferralHistoryItem } from '@/types/business';

import {
  formatBusinessNumber,
  formatBusinessDate,
  formatCredits,
  SubscriptionPreviewNotice,
  subscriptionPageStyles,
  SummaryTile,
  toDisplayCredits,
  toRawCredits,
  useBusinessSubscriptionProfile,
} from './shared';

const REFERRAL_CODE_RE = /^[A-Za-z0-9_]{2,8}$/;

const extractReferralCodeInput = (value: string) => {
  const trimmed = value.trim();
  const normalize = (input: string) => input.replace(/[^A-Za-z0-9_]/g, '').toUpperCase();

  try {
    const url = new URL(trimmed);
    return normalize(url.searchParams.get('ref') || '');
  } catch {
    return normalize(trimmed);
  }
};

const Referral = memo<{ mobile?: boolean }>(() => {
  const { t } = useTranslation('subscription');
  const { t: tCommon } = useTranslation('common');
  const { referralCode, referralLink, referralStatus } = useBusinessSubscriptionProfile();
  const { data: referralOverview } = useClientDataSWR(['business-referral-overview'], () =>
    commercialService.getReferralOverview(),
  );
  const { data: referralHistory = [], isLoading } = useClientDataSWR(
    ['business-referral-history'],
    () => commercialService.listReferralHistory({ limit: 20 }),
  );
  const [editableCode, setEditableCode] = useState(referralCode);
  const [draftCode, setDraftCode] = useState(referralCode);
  const [isEditing, setIsEditing] = useState(false);
  const [backfillCode, setBackfillCode] = useState('');
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [isBindingCode, setIsBindingCode] = useState(false);
  const [isActivatingReward, setIsActivatingReward] = useState(false);

  const effectiveReferralCode = referralOverview?.referralCode || editableCode;
  const effectiveReferralLink = referralLink.replace(
    /ref=[^&]*/i,
    `ref=${encodeURIComponent(effectiveReferralCode)}`,
  );
  const effectiveReferralStatus = referralOverview?.currentReferralStatus || referralStatus;
  const hasBoundReferral = Boolean(effectiveReferralStatus);
  const canActivateReward =
    effectiveReferralStatus === 'registered' || effectiveReferralStatus === 'pending_reward';

  useEffect(() => {
    if (referralOverview?.referralCode) {
      setEditableCode(referralOverview.referralCode);
      setDraftCode(referralOverview.referralCode);
    }
  }, [referralOverview?.referralCode]);

  const columns = useMemo<TableColumnType<ReferralHistoryItem>[]>(
    () => [
      {
        dataIndex: 'inviteeEmail',
        key: 'inviteeEmail',
        title: t('referral.table.columns.inviteeEmail'),
      },
      {
        dataIndex: 'inviterRewardAmount',
        key: 'inviterRewardAmount',
        render: (value) => formatCredits(value),
        title: t('referral.table.columns.inviterRewardAmount'),
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value) => t(`referral.table.status.${value}`),
        title: t('referral.table.columns.status'),
      },
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => formatBusinessDate(value),
        title: t('referral.table.columns.createdAt'),
      },
      {
        dataIndex: 'rewardedAt',
        key: 'rewardedAt',
        render: (value) => formatBusinessDate(value),
        title: t('referral.table.columns.rewardedAt'),
      },
    ],
    [t],
  );

  const copyText = async (
    value: string,
    successKey: 'referral.copy.codeSuccess' | 'referral.copy.linkSuccess',
  ) => {
    await navigator.clipboard.writeText(value);
    message.success(t(successKey));
  };

  const resolveReferralError = (error: unknown) => {
    const code = error instanceof Error ? error.message : '';

    switch (code) {
      case 'INVALID_REFERRAL_CODE_FORMAT':
        return t('referral.errors.invalidFormat');
      case 'REFERRAL_CODE_TAKEN':
        return t('referral.errors.codeExists');
      case 'REFERRAL_CODE_NOT_FOUND':
        return t('referral.errors.invalidCode');
      case 'REFERRAL_ALREADY_BOUND':
        return t('referral.rules.backfill.alreadyBound');
      case 'REFERRAL_BACKFILL_EXPIRED':
        return t('referral.errors.backfillExpired');
      case 'SELF_REFERRAL':
        return t('referral.errors.selfReferral');
      case 'REFERRAL_REWARD_NOT_FOUND':
        return t('referral.errors.rewardNotFound');
      case 'REFERRAL_REWARD_NOT_ACTIVATABLE':
        return t('referral.errors.rewardNotActivatable');
      default:
        return t('referral.errors.updateFailed');
    }
  };

  const refreshReferralData = async () => {
    await Promise.all([
      mutate(['business-referral-overview']),
      mutate(['business-referral-history']),
    ]);
  };

  const handleSaveCode = async () => {
    if (!REFERRAL_CODE_RE.test(draftCode)) {
      message.error(t('referral.errors.invalidFormat'));
      return;
    }

    setIsSavingCode(true);
    try {
      const nextOverview = await commercialService.updateReferralCode({
        code: draftCode.toUpperCase(),
      });

      setEditableCode(nextOverview.referralCode);
      setDraftCode(nextOverview.referralCode);
      setIsEditing(false);
      await refreshReferralData();
      message.success(t('referral.edit.saveSuccess'));
    } catch (error) {
      message.error(resolveReferralError(error));
    } finally {
      setIsSavingCode(false);
    }
  };

  const handleBindCode = async () => {
    const normalized = extractReferralCodeInput(backfillCode);

    if (hasBoundReferral) {
      message.error(t('referral.rules.backfill.alreadyBound'));
      return;
    }

    if (!REFERRAL_CODE_RE.test(normalized)) {
      message.error(t('referral.errors.invalidFormat'));
      return;
    }

    if (normalized.toUpperCase() === effectiveReferralCode.toUpperCase()) {
      message.error(t('referral.errors.selfReferral'));
      return;
    }

    setIsBindingCode(true);
    try {
      await commercialService.bindReferralCode({ code: normalized });
      setBackfillCode('');
      await refreshReferralData();
      message.success(t('referral.rules.backfill.success'));
    } catch (error) {
      message.error(resolveReferralError(error));
    } finally {
      setIsBindingCode(false);
    }
  };

  const handleActivateReward = async () => {
    setIsActivatingReward(true);
    try {
      await commercialService.activateReferralReward();
      await Promise.all([
        refreshReferralData(),
        mutate(['business-commercial-overview']),
        mutate(['business-credit-ledger']),
      ]);
      message.success(t('referral.activateRewardSuccess'));
    } catch (error) {
      message.error(resolveReferralError(error));
    } finally {
      setIsActivatingReward(false);
    }
  };

  return (
    <>
      <SettingHeader title={t('tab.referral')} />
      <FormGroup
        collapsible={false}
        gap={16}
        title={t('referral.inviteCode.title')}
        variant={'filled'}
      >
        <SubscriptionPreviewNotice />
        <div className={subscriptionPageStyles.cardGrid}>
          <SummaryTile
            caption={t('referral.inviteCode.description')}
            extra={
              isEditing ? (
                <Button
                  loading={isSavingCode}
                  size={'small'}
                  type={'primary'}
                  onClick={() => void handleSaveCode()}
                >
                  {t('referral.edit.save')}
                </Button>
              ) : (
                <Button size={'small'} onClick={() => setIsEditing(true)}>
                  {t('referral.edit.button')}
                </Button>
              )
            }
            title={t('referral.inviteCode.title')}
            value={
              isEditing ? (
                <Input
                  maxLength={8}
                  value={draftCode}
                  onChange={(e) => setDraftCode(e.target.value)}
                />
              ) : (
                effectiveReferralCode
              )
            }
          />
          <SummaryTile
            caption={t('referral.inviteLink.description')}
            extra={
              <Button
                size={'small'}
                onClick={() => void copyText(effectiveReferralLink, 'referral.copy.linkSuccess')}
              >
                {tCommon('copy')}
              </Button>
            }
            title={t('referral.inviteLink.title')}
            value={<Input readOnly value={effectiveReferralLink} />}
          />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button onClick={() => void copyText(effectiveReferralCode, 'referral.copy.codeSuccess')}>
            {tCommon('copy')}
          </Button>
          {isEditing && (
            <Button
              onClick={() => {
                setDraftCode(editableCode);
                setIsEditing(false);
              }}
            >
              {t('referral.edit.cancel')}
            </Button>
          )}
        </div>
      </FormGroup>
      <FormGroup collapsible={false} gap={16} title={t('referral.stats.title')} variant={'filled'}>
        <div className={subscriptionPageStyles.cardGrid}>
          <SummaryTile
            title={t('referral.stats.totalInvites')}
            value={String(referralOverview?.totalInvites ?? 0)}
          />
          <SummaryTile
            title={t('referral.stats.totalRewarded')}
            value={String(referralOverview?.totalRewarded ?? 0)}
          />
          <SummaryTile
            title={t('referral.stats.totalRewardedAmount')}
            value={formatCredits(referralOverview?.totalRewardedAmount ?? 0)}
          />
          <SummaryTile
            title={t('referral.table.columns.status')}
            value={
              effectiveReferralStatus ? t(`referral.table.status.${effectiveReferralStatus}`) : '--'
            }
          />
        </div>
        {canActivateReward ? (
          <div style={{ display: 'flex', gap: 12 }}>
            <Button
              loading={isActivatingReward}
              type={'primary'}
              onClick={() => void handleActivateReward()}
            >
              {t('referral.activateReward')}
            </Button>
          </div>
        ) : null}
      </FormGroup>
      <FormGroup collapsible={false} gap={16} title={t('referral.rules.title')} variant={'filled'}>
        <ul className={subscriptionPageStyles.featureList}>
          <li>{t('referral.rules.registration')}</li>
          <li>{t('referral.rules.validInvitation')}</li>
          <li>{t('referral.rules.validOperation')}</li>
          <li>
            {t('referral.rules.reward', {
              reward: formatBusinessNumber(
                toDisplayCredits(referralOverview?.rewardCreditsPerInvite ?? toRawCredits(100)),
              ),
            })}
          </li>
          <li>{t('referral.rules.rewardDelay')}</li>
          <li>{t('referral.rules.priority')}</li>
          <li>{t('referral.rules.expiry')}</li>
          <li>{t('referral.rules.antiAbuse')}</li>
        </ul>
        <div style={{ display: 'flex', gap: 12 }}>
          <Input
            placeholder={t('referral.rules.backfill.placeholder')}
            value={backfillCode}
            onChange={(e) => setBackfillCode(e.target.value)}
          />
          <Button loading={isBindingCode} type={'primary'} onClick={() => void handleBindCode()}>
            {t('referral.rules.backfill.submit')}
          </Button>
        </div>
      </FormGroup>
      <FormGroup collapsible={false} gap={16} title={t('referral.table.title')} variant={'filled'}>
        <InlineTable
          columns={columns}
          dataSource={referralHistory}
          locale={{ emptyText: <Empty description={t('billing.empty')} /> }}
          loading={isLoading}
          rowKey={(record) => record.id}
        />
      </FormGroup>
    </>
  );
});

Referral.displayName = 'Referral';
export default Referral;
