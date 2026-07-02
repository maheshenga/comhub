import { CREDITS_PER_DOLLAR } from '@lobechat/const/currency';

import { type AutoTopUpSetting, type UpdateAutoTopUpSettingParams } from '@/types/business';

export interface AutoTopUpFormState {
  enabled: boolean;
  monthlyLimitM: number | null;
  targetBalanceM: number;
  thresholdM: number;
}

const DEFAULT_AUTO_TOP_UP_THRESHOLD_M = 40;
const DEFAULT_AUTO_TOP_UP_TARGET_BALANCE_M = 120;

const toDisplayCredits = (value: number) => value / CREDITS_PER_DOLLAR;

const toRawCredits = (value: number) => Math.round(value * CREDITS_PER_DOLLAR);

export const createAutoTopUpFormState = (
  setting?: AutoTopUpSetting | null,
): AutoTopUpFormState => ({
  enabled: setting?.enabled ?? false,
  monthlyLimitM: setting?.monthlyLimit == null ? null : toDisplayCredits(setting.monthlyLimit),
  targetBalanceM: toDisplayCredits(
    setting?.targetBalance ?? toRawCredits(DEFAULT_AUTO_TOP_UP_TARGET_BALANCE_M),
  ),
  thresholdM: toDisplayCredits(setting?.threshold ?? toRawCredits(DEFAULT_AUTO_TOP_UP_THRESHOLD_M)),
});

export const buildAutoTopUpUpdateParams = (
  state: AutoTopUpFormState,
): UpdateAutoTopUpSettingParams => ({
  enabled: state.enabled,
  monthlyLimit: state.monthlyLimitM == null ? null : toRawCredits(state.monthlyLimitM),
  targetBalance: toRawCredits(state.targetBalanceM),
  threshold: toRawCredits(state.thresholdM),
});

export const canSaveAutoTopUpForm = (state: AutoTopUpFormState) =>
  state.targetBalanceM > state.thresholdM;
