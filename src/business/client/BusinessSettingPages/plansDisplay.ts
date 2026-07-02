import { Plans } from '@lobechat/types';

export const PLAN_DISPLAY_CURRENCY = 'CNY';

export type PlanDisplayBillingCycle = 'lifetime' | 'monthly' | 'one_time' | 'yearly';

export const OFFICIAL_PLAN_BILLING_CYCLES = ['yearly', 'monthly', 'one_time'] as const;

export type PlanPriceCatalogLike = {
  currency?: null | string;
  lifetimePrice?: null | number;
  monthlyPrice?: null | number;
  oneTimePrice?: null | number;
  yearlyPrice?: null | number;
};

export type PlanCyclePrice = {
  amount: number;
  currency: string;
  cycle: PlanDisplayBillingCycle;
  discountPercent: number;
  isAvailable: boolean;
  label: string;
  monthlyEquivalent?: number;
  secondaryLabel?: string;
  unit: string;
};

export const getVisiblePaidPlans = <T extends string>(plans: T[]) =>
  plans.filter((plan) => plan !== Plans.Free);

const officialThreeTierPlans = [Plans.Starter, Plans.Premium, Plans.Ultimate] as const;

export const getPrimaryPaidPlans = <T extends string>(plans: T[]) => {
  const paidPlans = getVisiblePaidPlans(plans);
  const officialPlans = officialThreeTierPlans.filter((plan) => paidPlans.includes(plan as T));

  return officialPlans.length === officialThreeTierPlans.length ? officialPlans : paidPlans;
};

const normalizeCurrency = (currency?: null | string) =>
  (currency?.trim() || PLAN_DISPLAY_CURRENCY).toUpperCase();

export const formatPlanCurrencyAmount = (value: number, currency?: null | string) => {
  const resolvedCurrency = normalizeCurrency(currency);

  try {
    return new Intl.NumberFormat('zh-CN', {
      currency: resolvedCurrency,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
      style: 'currency',
    }).format(value);
  } catch {
    return `${resolvedCurrency} ${value}`;
  }
};

export const getPlanYearlyDiscountPercent = (monthlyPrice: number, yearlyPrice: number) => {
  if (monthlyPrice <= 0 || yearlyPrice <= 0) return 0;

  return Math.max(0, Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100));
};

export const resolvePlanCyclePrice = (
  catalogPlan: PlanPriceCatalogLike | null | undefined,
  cycle: PlanDisplayBillingCycle,
): PlanCyclePrice => {
  const currency = normalizeCurrency(catalogPlan?.currency);
  const lifetimePrice = Number(catalogPlan?.lifetimePrice ?? 0);
  const monthlyPrice = Number(catalogPlan?.monthlyPrice ?? 0);
  const oneTimePrice = Number(catalogPlan?.oneTimePrice ?? 0);
  const yearlyPrice = Number(catalogPlan?.yearlyPrice ?? 0);
  const discountPercent = getPlanYearlyDiscountPercent(monthlyPrice, yearlyPrice);

  const build = ({
    amount,
    monthlyEquivalent,
    secondaryLabel,
    unit,
  }: {
    amount: number;
    monthlyEquivalent?: number;
    secondaryLabel?: string;
    unit: string;
  }): PlanCyclePrice => ({
    amount,
    currency,
    cycle,
    discountPercent,
    isAvailable: amount > 0,
    label: amount > 0 ? formatPlanCurrencyAmount(amount, currency) : '--',
    ...(monthlyEquivalent === undefined ? {} : { monthlyEquivalent }),
    ...(secondaryLabel === undefined ? {} : { secondaryLabel }),
    unit,
  });

  switch (cycle) {
    case 'yearly': {
      const monthlyEquivalent = yearlyPrice > 0 ? yearlyPrice / 12 : undefined;

      return {
        amount: yearlyPrice,
        currency,
        cycle,
        discountPercent,
        isAvailable: yearlyPrice > 0,
        label: monthlyEquivalent ? formatPlanCurrencyAmount(monthlyEquivalent, currency) : '--',
        ...(monthlyEquivalent === undefined ? {} : { monthlyEquivalent }),
        secondaryLabel:
          yearlyPrice > 0
            ? `${formatPlanCurrencyAmount(yearlyPrice, currency)} / 每年`
            : '暂未配置年付价格',
        unit: '每月 (按年)',
      };
    }

    case 'one_time': {
      const hasConfiguredAmount = oneTimePrice > 0;
      const amount = hasConfiguredAmount
        ? oneTimePrice
        : monthlyPrice > 0
          ? Number((monthlyPrice * 12).toFixed(2))
          : 0;

      return build({
        amount,
        secondaryLabel:
          amount > 0
            ? hasConfiguredAmount
              ? '一次性支付'
              : '按 12 个月月付价估算，最终以购买页为准'
            : '暂未配置一次性价格',
        unit: '一次性',
      });
    }

    case 'lifetime': {
      const hasConfiguredAmount = lifetimePrice > 0;
      const amount = hasConfiguredAmount
        ? lifetimePrice
        : monthlyPrice > 0
          ? Number((monthlyPrice * 24).toFixed(2))
          : 0;

      return build({
        amount,
        secondaryLabel:
          amount > 0
            ? hasConfiguredAmount
              ? '终身权益价格'
              : '按 24 个月月付价估算，最终以购买页为准'
            : '暂未配置终身价格',
        unit: '终身',
      });
    }

    default: {
      return build({
        amount: monthlyPrice,
        ...(yearlyPrice > 0
          ? {
              secondaryLabel: `${formatPlanCurrencyAmount(yearlyPrice, currency)} / 年${
                discountPercent > 0 ? `，年付优惠 ${discountPercent}%` : ''
              }`,
            }
          : {}),
        unit: '月',
      });
    }
  }
};
