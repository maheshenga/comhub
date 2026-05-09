import { Plans } from '@lobechat/types';

export const PLAN_DISPLAY_CURRENCY = 'CNY';

export const getVisiblePaidPlans = <T extends string>(plans: T[]) =>
  plans.filter((plan) => plan !== Plans.Free);

export const formatPlanCurrencyAmount = (value: number, _currency?: string) => {
  try {
    return new Intl.NumberFormat('zh-CN', {
      currency: PLAN_DISPLAY_CURRENCY,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
      style: 'currency',
    }).format(value);
  } catch {
    return `¥${value}`;
  }
};
