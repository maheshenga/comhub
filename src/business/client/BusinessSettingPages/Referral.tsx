'use client';

import { FormGroup, Icon } from '@lobehub/ui';
import { type TableColumnType } from 'antd';
import { Button, Empty, Input, message } from 'antd';
import { Copy, Gift, Pencil } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { refreshCommercialEntitlementState } from '@/business/client/commercialRefresh';
import InlineTable from '@/components/InlineTable';
import { mutate, useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { commercialService } from '@/services/commercial';
import { type ReferralHistoryItem } from '@/types/business';

import {
  formatBusinessDate,
  formatBusinessNumber,
  formatCredits,
  OverviewPanel,
  subscriptionPageStyles,
  SummaryTile,
  toDisplayCredits,
  toRawCredits,
  useBusinessSubscriptionProfile,
} from './shared';

const REFERRAL_CODE_RE = /^\d{7}$/;

const extractReferralCodeInput = (value: string) => {
  const trimmed = value.trim();
  const normalize = (input: string) => input.replaceAll(/\D/g, '').slice(0, 7);

  try {
    const url = new URL(trimmed);
    return normalize(url.searchParams.get('ref') || url.searchParams.get('referral') || '');
  } catch {
    return normalize(trimmed);
  }
};

const Referral = memo<{ mobile?: boolean }>(() => {
  const { t } = useTranslation('subscription');
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
    /referral=[^&]*/i,
    `referral=${encodeURIComponent(effectiveReferralCode)}`,
  );
  const effectiveReferralStatus = referralOverview?.currentReferralStatus || referralStatus;
  const hasBoundReferral = Boolean(effectiveReferralStatus);
  const canActivateReward =
    effectiveReferralStatus === 'registered' || effectiveReferralStatus === 'pending_reward';
  const rewardCredits = referralOverview?.rewardCreditsPerInvite ?? toRawCredits(100);
  const rewardText = formatBusinessNumber(toDisplayCredits(rewardCredits));

  useEffect(() => {
    if (referralOverview?.referralCode) {
      setEditableCode(referralOverview.referralCode);
      setDraftCode(referralOverview.referralCode);
    }
  }, [referralOverview?.referralCode]);

  const columns = useMemo<TableColumnType<ReferralHistoryItem>[]>(
    () => [
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => formatBusinessDate(value),
        title: '注册时间',
      },
      {
        dataIndex: 'inviteeEmail',
        key: 'inviteeEmail',
        render: (value) => value || '--',
        title: '被邀请人邮箱',
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value) => t(`referral.table.status.${value}` as any),
        title: '状态',
      },
      {
        dataIndex: 'inviterRewardAmount',
        key: 'inviterRewardAmount',
        render: (value) => formatCredits(value),
        title: '我的奖励',
      },
      {
        dataIndex: 'rewardedAt',
        key: 'rewardedAt',
        render: (value) => formatBusinessDate(value),
        title: '奖励时间',
      },
    ],
    [t],
  );

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    message.success(`${label}已复制`);
  };

  const resolveReferralError = (error: unknown) => {
    const code = error instanceof Error ? error.message : '';

    switch (code) {
      case 'INVALID_REFERRAL_CODE_FORMAT': {
        return '推荐码必须为 7 位数字';
      }
      case 'REFERRAL_CODE_TAKEN': {
        return '推荐码已被占用';
      }
      case 'REFERRAL_CODE_NOT_FOUND': {
        return '推荐码不存在';
      }
      case 'REFERRAL_ALREADY_BOUND': {
        return '你已经绑定过邀请码';
      }
      case 'REFERRAL_BACKFILL_EXPIRED': {
        return '补填邀请码已过期';
      }
      case 'SELF_REFERRAL': {
        return '不能绑定自己的推荐码';
      }
      case 'REFERRAL_REWARD_NOT_FOUND': {
        return '没有可领取的推荐奖励';
      }
      case 'REFERRAL_REWARD_NOT_ACTIVATABLE': {
        return '推荐奖励暂不可领取';
      }
      default: {
        return '操作失败，请稍后重试';
      }
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
      message.error('推荐码必须为 7 位数字');
      return;
    }

    setIsSavingCode(true);
    try {
      const nextOverview = await commercialService.updateReferralCode({
        code: draftCode,
      });

      setEditableCode(nextOverview.referralCode);
      setDraftCode(nextOverview.referralCode);
      setIsEditing(false);
      await refreshReferralData();
      message.success('推荐码已保存');
    } catch (error) {
      message.error(resolveReferralError(error));
    } finally {
      setIsSavingCode(false);
    }
  };

  const handleBindCode = async () => {
    const normalized = extractReferralCodeInput(backfillCode);

    if (hasBoundReferral) {
      message.error('你已经绑定过邀请码');
      return;
    }

    if (!REFERRAL_CODE_RE.test(normalized)) {
      message.error('推荐码必须为 7 位数字');
      return;
    }

    if (normalized === effectiveReferralCode) {
      message.error('不能绑定自己的推荐码');
      return;
    }

    setIsBindingCode(true);
    try {
      await commercialService.bindReferralCode({ code: normalized });
      setBackfillCode('');
      await refreshReferralData();
      message.success('邀请码绑定成功');
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
      await Promise.all([refreshReferralData(), refreshCommercialEntitlementState()]);
      message.success('推荐奖励已领取');
    } catch (error) {
      message.error(resolveReferralError(error));
    } finally {
      setIsActivatingReward(false);
    }
  };

  return (
    <>
      <SettingHeader title="推荐奖励" />
      <div className={subscriptionPageStyles.pageStack}>
        <OverviewPanel
          title={
            <>
              邀请好友，双方各得 {rewardText}M 积分
            </>
          }
          description={`把下方的推荐链接分享给好友，好友完成有效转化后，你和好友将各自获得 ${rewardText}M 积分。`}
          extra={<Icon icon={Gift} size={28} />}
        />
        <FormGroup collapsible={false} gap={16} title="推荐链接" variant="filled">
          <div className={subscriptionPageStyles.monoBlock}>{effectiveReferralLink}</div>
          <Button
            icon={<Icon icon={Copy} />}
            onClick={() => void copyText(effectiveReferralLink, '推荐链接')}
          >
            复制链接
          </Button>
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title="我的专属推荐码" variant="filled">
          {isEditing ? (
            <Input
              maxLength={7}
              value={draftCode}
              onChange={(e: { target: { value: string } }) =>
                setDraftCode(e.target.value.replaceAll(/\D/g, '').slice(0, 7))
              }
            />
          ) : (
            <div className={subscriptionPageStyles.monoBlock}>{effectiveReferralCode}</div>
          )}
          <div className={subscriptionPageStyles.actionRow}>
            <Button
              icon={<Icon icon={Copy} />}
              onClick={() => void copyText(effectiveReferralCode, '推荐码')}
            >
              复制
            </Button>
            {isEditing ? (
              <>
                <Button loading={isSavingCode} type="primary" onClick={() => void handleSaveCode()}>
                  保存
                </Button>
                <Button
                  onClick={() => {
                    setDraftCode(editableCode);
                    setIsEditing(false);
                  }}
                >
                  取消
                </Button>
              </>
            ) : (
              <Button icon={<Icon icon={Pencil} />} onClick={() => setIsEditing(true)}>
                编辑
              </Button>
            )}
          </div>
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title="推荐概览" variant="filled">
          <div className={subscriptionPageStyles.cardGrid}>
            <SummaryTile title="邀请总数" value={String(referralOverview?.totalInvites ?? 0)} />
            <SummaryTile title="有效转化" value={String(referralOverview?.totalRewarded ?? 0)} />
            <SummaryTile
              title="累计奖励"
              value={formatCredits(referralOverview?.totalRewardedAmount ?? 0)}
            />
            <SummaryTile
              title="可用余额"
              value={formatCredits(referralOverview?.totalRewardedAmount ?? 0)}
            />
          </div>
          {canActivateReward ? (
            <Button
              loading={isActivatingReward}
              type="primary"
              onClick={() => void handleActivateReward()}
            >
              领取推荐奖励
            </Button>
          ) : null}
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title="推荐记录" variant="filled">
          <InlineTable
            columns={columns as any}
            dataSource={referralHistory}
            loading={isLoading}
            locale={{ emptyText: <Empty description="暂无数据" /> }}
            rowKey={(record) => record.id}
          />
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title="计划规则" variant="filled">
          <ol className={subscriptionPageStyles.featureList}>
            <li>注册方式：被邀请用户通过推荐链接注册，或在注册页输入推荐码。</li>
            <li>推荐码规则：系统默认生成随机 7 位数字，也可以手动改为未被占用的 7 位数字。</li>
            <li>有效邀请：被邀请人使用你的推荐码注册并完成一次有效操作。</li>
            <li>有效操作标准：在对话页发送一条消息，或在图片页生成一张图片。</li>
            <li>奖励：邀请人和被邀请人各获得 {rewardText}M 积分。</li>
            <li>奖励处理：积分将在审核通过后发放，审核最多需要 6 小时。</li>
            <li>
              积分使用优先级：订阅积分 {'>'} 推荐积分 {'>'} 充值积分 {'>'} 其他积分。
            </li>
            <li>积分有效期：用户 100 天未活跃后，推荐积分将被清除。</li>
            <li>忘记填写邀请码：注册三天内可以补填邀请码。</li>
            <li>如检测到通过不正当手段获取积分，相关账号将被永久封禁。</li>
          </ol>
          <div className={subscriptionPageStyles.actionRow}>
            <Input
              placeholder="输入 7 位推荐码或推荐链接"
              style={{ maxWidth: 360 }}
              value={backfillCode}
              onChange={(e: { target: { value: string } }) => setBackfillCode(e.target.value)}
            />
            <Button loading={isBindingCode} type="primary" onClick={() => void handleBindCode()}>
              确认绑定
            </Button>
          </div>
        </FormGroup>
      </div>
    </>
  );
});

Referral.displayName = 'Referral';
export default Referral;
