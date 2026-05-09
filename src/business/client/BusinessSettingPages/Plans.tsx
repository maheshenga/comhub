'use client';

import { Plans as SubscriptionPlan } from '@lobechat/types';
import { Flexbox, Icon, Segmented } from '@lobehub/ui';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  message,
  Modal,
  Skeleton,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import { createStyles, cssVar } from 'antd-style';
import { Check, ChevronRight, Info, LockKeyhole, Sparkles, Ticket } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import PlanIcon from '@/features/PlanIcon';
import { mutate, useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { commercialService } from '@/services/commercial';

import { getPlanPurchaseUrl } from './planPurchase';
import { formatPlanCurrencyAmount, getVisiblePaidPlans } from './plansDisplay';
import {
  formatBusinessNumber,
  formatCredits,
  getSubscriptionCycleTranslationKey,
  subscriptionPageStyles,
  subscriptionPlanOrder,
  useBusinessSubscriptionProfile,
} from './shared';

type ModelRule = { allowlist?: string[]; blocklist?: string[]; mode?: string };

const MODEL_TYPE_LABELS: Record<string, string> = {
  chat: '对话模型',
  embedding: '向量模型',
  image: '图像模型',
  realtime: '实时模型',
  stt: '语音识别',
  text2music: '音乐模型',
  tts: '语音合成',
  video: '视频模型',
};

const PLAN_FEATURES_FALLBACK: Record<SubscriptionPlan, string[]> = {
  [SubscriptionPlan.Free]: ['500,000 算力积分', '10 MB 文件存储', '社区模型与插件市场'],
  [SubscriptionPlan.Hobby]: ['自定义 API 服务', '社区支持', '基础模型能力'],
  [SubscriptionPlan.Starter]: ['文件与知识库', '1 GB 文件存储', '邮件与社区支持'],
  [SubscriptionPlan.Premium]: ['文件与知识库', '2 GB 文件存储', '优先邮件支持'],
  [SubscriptionPlan.Ultimate]: ['高级模型服务', '4 GB 文件存储', '优先聊天与邮件支持'],
};

const FEATURE_GROUPS = [
  {
    description: '在对话中使用文件和知识库，支持 PDF / MD / DOC / XLS / PPT 等格式。',
    items: ['文件存储', '向量存储'],
    title: '文件与知识库',
  },
  {
    items: ['全局主流模型自定义 API 服务', '无限消息请求'],
    title: '模型服务',
  },
  {
    items: ['无限对话历史', '全球云端同步'],
    title: '云服务',
  },
  {
    items: ['精选智能体市场', '专属高级插件', '智能网页搜索'],
    title: '高级功能',
  },
];

const MODEL_MESSAGE_ESTIMATES = [
  { divisor: 141, model: 'DeepSeek V4 Pro' },
  { divisor: 16_666, model: 'Claude Sonnet 4.6' },
  { divisor: 12_500, model: 'Gemini 3.1 Pro Preview' },
  { divisor: 30_000, model: 'GPT-5.5' },
];

const MODEL_PRICE_ROWS = [
  { input: '0.044M', model: 'DeepSeek V4 Pro (1M)', output: '0.087M' },
  { input: '3M', model: 'Claude Sonnet 4.6 (1M)', output: '15M' },
  { input: '2M', model: 'Gemini 3.1 Pro Preview (1M)', output: '12M' },
  { input: '5M', model: 'GPT-5.5 (1M)', output: '30M' },
  { input: '0.75M', model: 'GPT-5.4 mini (400K)', output: '4.5M' },
  { input: '0.25M', model: 'GPT-5 mini (400K)', output: '2M' },
];

type BillingCycle = 'yearly' | 'monthly' | 'one_time';
type PlanCatalog = Awaited<ReturnType<typeof commercialService.listPlanCatalog>>;
type PlanCatalogItem = PlanCatalog[number];

const useStyles = createStyles(({ css, cx, token }) => ({
  action: css`
    height: 38px;
    border-radius: 8px;
    font-weight: 600;
  `,
  actionGrid: css`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  `,
  benefit: css`
    display: flex;
    gap: 8px;
    align-items: flex-start;

    font-size: 13px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
  `,
  benefitIcon: css`
    flex: none;
    margin-block-start: 2px;
    color: ${token.colorSuccess};
  `,
  card: css`
    position: relative;

    overflow: hidden;

    height: 100%;
    min-height: 620px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    background: ${cssVar.colorBgContainer};

    .ant-card-body {
      height: 100%;
      padding-block: 18px;
      padding-inline: 16px;
    }
  `,
  currentCard: css`
    border-color: ${token.colorPrimary};
    box-shadow: 0 0 0 1px ${token.colorPrimaryBorder};
  `,
  cycleWrap: css`
    display: flex;
    justify-content: center;
    margin-block: 4px 10px;
  `,
  featureGroup: css`
    display: flex;
    flex-direction: column;
    gap: 9px;

    padding-block-start: 18px;
    border-block-start: 1px dashed ${cssVar.colorBorderSecondary};
  `,
  grid: css`
    scrollbar-width: thin;

    overflow-x: auto;
    display: flex;
    gap: 12px;

    padding-block-end: 4px;

    > .ant-card {
      flex: 0 0 min(320px, 86vw);
    }

    @media (width >= 1280px) {
      > .ant-card {
        flex-basis: calc((100% - 36px) / 4);
      }
    }
  `,
  header: css`
    min-height: 116px;
  `,
  modelTag: css`
    max-width: 100%;
    margin: 0;
    border-radius: 999px;
  `,
  popularRibbon: css`
    position: absolute;
    inset-block-start: 16px;
    inset-inline-end: 16px;

    font-size: 12px;
    color: ${token.orange6};
  `,
  price: css`
    display: flex;
    gap: 6px;
    align-items: baseline;

    margin-block: 10px 4px;

    font-size: 30px;
    font-weight: 700;
    line-height: 1;
    color: ${cssVar.colorText};
    white-space: nowrap;
  `,
  priceUnit: css`
    font-size: 13px;
    font-weight: 500;
    color: ${cssVar.colorTextDescription};
  `,
  pricingCard: css`
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    .ant-card-body {
      padding: 16px;
    }
  `,
  sectionTitle: css`
    display: flex;
    gap: 6px;
    align-items: center;

    font-size: 13px;
    font-weight: 600;
    color: ${cssVar.colorText};
  `,
  subtitle: css`
    min-height: 40px;
    font-size: 13px;
    line-height: 1.55;
    color: ${cssVar.colorTextDescription};
  `,
  title: css`
    margin: 0;

    font-size: 17px;
    font-weight: 700;
    line-height: 1.25;
    color: ${cssVar.colorText};
  `,
  top: css`
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  `,
  wrapper: cx(
    subscriptionPageStyles.caption,
    css`
      display: flex;
      flex-direction: column;
      gap: 16px;
      color: ${cssVar.colorText};
    `,
  ),
  yearlyLine: css`
    display: flex;
    gap: 8px;
    align-items: center;

    min-height: 22px;

    font-size: 13px;
    color: ${cssVar.colorTextDescription};
  `,
}));

const getPlanKey = (plan: string): SubscriptionPlan | null =>
  subscriptionPlanOrder.includes(plan as SubscriptionPlan) ? (plan as SubscriptionPlan) : null;

const getCatalogPlan = (planCatalog: PlanCatalog | undefined, plan: SubscriptionPlan) =>
  planCatalog?.find((item) => item.plan === plan);

const getDiscountPercent = (monthlyPrice: number, yearlyPrice: number) => {
  if (monthlyPrice <= 0 || yearlyPrice <= 0) return 0;

  return Math.max(0, Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100));
};

const getRuleCount = (rule?: ModelRule) => {
  if (!rule) return 0;

  return rule.mode === 'blocklist' ? rule.blocklist?.length || 0 : rule.allowlist?.length || 0;
};

const formatEstimatedMessages = (monthlyCredits: number, divisor: number) => {
  if (monthlyCredits <= 0) return '约 0 条消息';

  return `约 ${formatBusinessNumber(Math.max(1, Math.floor(monthlyCredits / divisor)))} 条消息`;
};

const Plans = memo<{ mobile?: boolean }>(() => {
  const { styles, cx } = useStyles();
  const { t } = useTranslation('subscription');
  const { currentPlan, subscriptionSummary } = useBusinessSubscriptionProfile();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const { data: planCatalog, isLoading: isPlanCatalogLoading } = useClientDataSWR(
    ['business-plan-catalog'],
    () => commercialService.listPlanCatalog(),
  );
  const { data: pendingChangeRequest } = useClientDataSWR(
    ['business-subscription-change-request'],
    () => commercialService.getPendingSubscriptionChangeRequest(),
  );

  const visiblePlans = useMemo(() => {
    const configuredPlans = (planCatalog || [])
      .map((item) => getPlanKey(item.plan))
      .filter(Boolean) as SubscriptionPlan[];
    const orderedConfiguredPlans = subscriptionPlanOrder.filter((plan) =>
      configuredPlans.includes(plan),
    );

    return getVisiblePaidPlans(
      orderedConfiguredPlans.length > 0 ? orderedConfiguredPlans : [...subscriptionPlanOrder],
    );
  }, [planCatalog]);

  const getPlanFeatures = (plan: SubscriptionPlan) => {
    const catalogPlan = getCatalogPlan(planCatalog, plan);
    const configuredFeatures = catalogPlan?.features?.filter(Boolean);

    return configuredFeatures && configuredFeatures.length > 0
      ? configuredFeatures
      : PLAN_FEATURES_FALLBACK[plan];
  };

  const getPrice = (catalogPlan?: PlanCatalogItem) => {
    if (!catalogPlan)
      return { label: '--', unit: t(getSubscriptionCycleTranslationKey(billingCycle)) };

    if (billingCycle === 'monthly') {
      return {
        label: formatPlanCurrencyAmount(catalogPlan.monthlyPrice, catalogPlan.currency),
        unit: '人民币 / 月',
      };
    }

    if (billingCycle === 'one_time') {
      return {
        label:
          catalogPlan.yearlyPrice > 0
            ? formatPlanCurrencyAmount(catalogPlan.yearlyPrice, catalogPlan.currency)
            : '--',
        unit: '人民币 / 一次性',
      };
    }

    return {
      label: formatPlanCurrencyAmount(catalogPlan.monthlyPrice, catalogPlan.currency),
      unit: '人民币 / 月（按年）',
    };
  };

  const handleUpgradeClick = (catalogPlan?: PlanCatalogItem) => {
    const purchaseUrl = getPlanPurchaseUrl(catalogPlan);
    if (purchaseUrl) {
      window.open(purchaseUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    message.info(t('billing.purchaseDisabledHint', '在线支付暂未开放，请联系管理员升级套餐。'));
  };

  const handleRedeem = async () => {
    const code = redeemCode.trim().toUpperCase();
    if (!code) {
      message.error('请输入兑换码');
      return;
    }

    setRedeeming(true);
    try {
      await commercialService.redeemCode(code);
      message.success('兑换成功，权益已发放');
      setRedeemCode('');
      setRedeemOpen(false);
      await Promise.all([
        mutate(['business-commercial-overview']),
        mutate(['business-plan-catalog']),
        mutate(['business-subscription-change-request']),
        mutate(['business-credit-ledger']),
      ]);
    } catch (error: any) {
      const msg = error?.message || '';
      const errorMap: Record<string, string> = {
        CODE_ALREADY_REDEEMED: '兑换码已被使用',
        CODE_DISABLED: '兑换码已停用',
        CODE_EXPIRED: '兑换码已过期',
        CODE_NOT_FOUND: '兑换码不存在',
        CODE_RACE: '兑换码已被使用',
      };
      const matched = Object.keys(errorMap).find((key) => msg.includes(key));
      message.error(matched ? errorMap[matched] : '兑换失败，请检查兑换码');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <>
      <SettingHeader title="套餐" />
      <div className={styles.wrapper}>
        <div className={styles.cycleWrap}>
          <Segmented
            value={billingCycle}
            variant="filled"
            options={[
              {
                label: (
                  <Flexbox horizontal align="center" gap={8}>
                    按年
                    <Tag color="green" style={{ margin: 0 }}>
                      最高优惠 37%
                    </Tag>
                  </Flexbox>
                ),
                value: 'yearly',
              },
              { label: '按月', value: 'monthly' },
              { label: '一次性', value: 'one_time' },
            ]}
            onChange={(value) => setBillingCycle(value as BillingCycle)}
          />
        </div>
        {pendingChangeRequest ? (
          <Alert
            showIcon
            message="存在待处理的套餐变更"
            type="info"
            description={t('plans.pendingChangeDescription', {
              cycle: t(getSubscriptionCycleTranslationKey(pendingChangeRequest.cycle)),
              from: t(`plans.plan.${pendingChangeRequest.fromPlan}.title`),
              to: t(`plans.plan.${pendingChangeRequest.toPlan}.title`),
            })}
          />
        ) : null}
        {isPlanCatalogLoading ? (
          <div className={styles.grid}>
            {visiblePlans.slice(0, 3).map((plan) => (
              <Card className={styles.card} key={plan}>
                <Skeleton active paragraph={{ rows: 12 }} />
              </Card>
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {visiblePlans.map((plan) => {
              const catalogPlan = getCatalogPlan(planCatalog, plan);
              const price = getPrice(catalogPlan);
              const monthlyCredits =
                catalogPlan?.monthlyCredits ?? subscriptionSummary?.monthlyCredits ?? 0;
              const discountPercent = catalogPlan
                ? getDiscountPercent(catalogPlan.monthlyPrice, catalogPlan.yearlyPrice)
                : 0;
              const isCurrent = plan === currentPlan;
              const isPending = pendingChangeRequest?.toPlan === plan;
              const isPopular = plan === SubscriptionPlan.Premium;
              const modelRules = (catalogPlan?.modelRules || {}) as Record<string, ModelRule>;
              const modelRuleEntries = Object.entries(modelRules).filter(([, rule]) =>
                Boolean(rule),
              );

              return (
                <Card
                  className={cx(styles.card, isCurrent && styles.currentCard)}
                  key={plan}
                  variant="borderless"
                >
                  {isPopular ? <div className={styles.popularRibbon}>最受欢迎</div> : null}
                  <Flexbox gap={20} height="100%" justify="space-between">
                    <Flexbox gap={18}>
                      <Flexbox className={styles.header} gap={14}>
                        <div className={styles.top}>
                          <PlanIcon plan={plan} size={38} />
                          <Flexbox horizontal align="center" gap={6}>
                            {isCurrent ? <Tag color="blue">当前套餐</Tag> : null}
                            {isPending ? <Tag color="processing">待处理</Tag> : null}
                          </Flexbox>
                        </div>
                        <Flexbox gap={8}>
                          <h2 className={styles.title}>
                            {catalogPlan?.displayName || t(`plans.plan.${plan}.title`)}
                          </h2>
                          <div className={styles.subtitle}>{t(`plans.plan.${plan}.desc`)}</div>
                        </Flexbox>
                      </Flexbox>
                      <Flexbox gap={8}>
                        <div className={styles.price}>
                          <span>{price.label}</span>
                          <span className={styles.priceUnit}>/ {price.unit}</span>
                        </div>
                        <div className={styles.yearlyLine}>
                          {catalogPlan?.yearlyPrice
                            ? `${formatPlanCurrencyAmount(
                                catalogPlan.yearlyPrice,
                                catalogPlan.currency,
                              )} / 人民币 / 年`
                            : '--'}
                          {billingCycle === 'yearly' && discountPercent > 0 ? (
                            <Tag color="green" style={{ margin: 0 }}>
                              优惠 {discountPercent}%
                            </Tag>
                          ) : null}
                        </div>
                        {isCurrent || isPending ? (
                          <Button
                            block
                            disabled
                            className={styles.action}
                            icon={<Icon icon={isCurrent ? Check : LockKeyhole} />}
                            type="default"
                          >
                            {isCurrent ? '当前套餐' : '待处理'}
                          </Button>
                        ) : (
                          <div className={styles.actionGrid}>
                            <Button
                              className={styles.action}
                              icon={<Icon icon={Ticket} />}
                              onClick={() => setRedeemOpen(true)}
                            >
                              兑换
                            </Button>
                            <Button
                              className={styles.action}
                              icon={<Icon icon={ChevronRight} />}
                              type="primary"
                              onClick={() => handleUpgradeClick(catalogPlan)}
                            >
                              升级
                            </Button>
                          </div>
                        )}
                      </Flexbox>
                      <Flexbox className={styles.featureGroup} gap={10}>
                        <div className={styles.sectionTitle}>
                          <Icon icon={Sparkles} size={15} />
                          算力积分
                          <Tooltip title="不同模型的实际消息数会随上下文长度、输出长度和后台计费规则变化。">
                            <Icon icon={Info} size={14} />
                          </Tooltip>
                        </div>
                        <div className={styles.benefit}>
                          <Icon className={styles.benefitIcon} icon={Check} size={15} />
                          <span>{formatCredits(monthlyCredits)} / 每月</span>
                        </div>
                        {MODEL_MESSAGE_ESTIMATES.map((item) => (
                          <div className={styles.benefit} key={item.model}>
                            <Icon className={styles.benefitIcon} icon={Check} size={15} />
                            <span>
                              {item.model}
                              <br />
                              {formatEstimatedMessages(monthlyCredits, item.divisor)}
                            </span>
                          </div>
                        ))}
                      </Flexbox>
                      <Flexbox className={styles.featureGroup} gap={10}>
                        <div className={styles.sectionTitle}>后台配置权益</div>
                        {getPlanFeatures(plan).map((feature) => (
                          <div className={styles.benefit} key={feature}>
                            <Icon className={styles.benefitIcon} icon={Check} size={15} />
                            <span>{feature.includes('.') ? t(feature as any) : feature}</span>
                          </div>
                        ))}
                      </Flexbox>
                      {FEATURE_GROUPS.map((group) => (
                        <Flexbox className={styles.featureGroup} gap={10} key={group.title}>
                          <div className={styles.sectionTitle}>{group.title}</div>
                          {group.description ? (
                            <div className={subscriptionPageStyles.caption}>
                              {group.description}
                            </div>
                          ) : null}
                          {group.items.map((item) => (
                            <div className={styles.benefit} key={item}>
                              <Icon className={styles.benefitIcon} icon={Check} size={15} />
                              <span>{item}</span>
                            </div>
                          ))}
                        </Flexbox>
                      ))}
                      <Flexbox className={styles.featureGroup} gap={10}>
                        <div className={styles.sectionTitle}>
                          模型权限
                          <Tooltip title="这里汇总后台 API 设置中每个套餐的模型 allowlist/blocklist 规则。">
                            <Icon icon={Info} size={14} />
                          </Tooltip>
                        </div>
                        {modelRuleEntries.length > 0 ? (
                          <Flexbox horizontal gap={6} wrap="wrap">
                            {modelRuleEntries.map(([type, rule]) => (
                              <Tag className={styles.modelTag} key={type}>
                                {MODEL_TYPE_LABELS[type] || type}
                                {' / '}
                                {rule?.mode === 'blocklist' ? '排除' : '可用'} {getRuleCount(rule)}
                              </Tag>
                            ))}
                          </Flexbox>
                        ) : (
                          <div className={styles.benefit}>
                            <Icon className={styles.benefitIcon} icon={Check} size={15} />
                            <span>默认可用模型</span>
                          </div>
                        )}
                      </Flexbox>
                    </Flexbox>
                  </Flexbox>
                </Card>
              );
            })}
          </div>
        )}
        <Card className={styles.pricingCard} variant="borderless">
          <Flexbox gap={12}>
            <Flexbox gap={4}>
              <h2 className={styles.title}>文本模型价格</h2>
              <div className={subscriptionPageStyles.caption}>
                平台使用算力积分衡量 AI 模型使用量。下表显示每百万 Token 的参考消耗。
              </div>
            </Flexbox>
            <Table
              dataSource={MODEL_PRICE_ROWS}
              locale={{ emptyText: <Empty description="暂无价格数据" /> }}
              pagination={false}
              rowKey="model"
              size="small"
              columns={[
                { dataIndex: 'model', title: '模型' },
                {
                  dataIndex: 'input',
                  render: (value) => `${value} 算力积分`,
                  title: '输入 1M Tokens',
                },
                {
                  dataIndex: 'output',
                  render: (value) => `${value} 算力积分`,
                  title: '输出 1M Tokens',
                },
              ]}
            />
          </Flexbox>
        </Card>
      </div>
      <Modal
        confirmLoading={redeeming}
        okText="确认兑换"
        open={redeemOpen}
        title="兑换激活码"
        onOk={handleRedeem}
        onCancel={() => {
          setRedeemOpen(false);
          setRedeemCode('');
        }}
      >
        <Flexbox gap={10}>
          <div className={subscriptionPageStyles.caption}>
            输入后台发放的套餐、积分或充值兑换码，兑换成功后权益会自动到账。
          </div>
          <Input
            autoFocus
            placeholder="请输入激活码"
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
            onPressEnter={() => void handleRedeem()}
          />
        </Flexbox>
      </Modal>
    </>
  );
});

Plans.displayName = 'Plans';
export default Plans;
