import { describe, expect, it } from 'vitest';

import {
  buildAutoTopUpUpdateParams,
  canSaveAutoTopUpForm,
  createAutoTopUpFormState,
} from './creditsDisplay';

describe('creditsDisplay', () => {
  it('creates an auto top-up form state from raw credit settings', () => {
    expect(
      createAutoTopUpFormState({
        enabled: true,
        monthlyLimit: 200_000_000,
        monthlyTopUpAmount: 0,
        targetBalance: 120_000_000,
        threshold: 40_000_000,
        updatedAt: null,
      }),
    ).toEqual({
      enabled: true,
      monthlyLimitM: 200,
      targetBalanceM: 120,
      thresholdM: 40,
    });
  });

  it('falls back to official-style defaults when no setting has loaded yet', () => {
    expect(createAutoTopUpFormState(null)).toEqual({
      enabled: false,
      monthlyLimitM: null,
      targetBalanceM: 120,
      thresholdM: 40,
    });
  });

  it('builds raw credit update params from form state', () => {
    expect(
      buildAutoTopUpUpdateParams({
        enabled: true,
        monthlyLimitM: null,
        targetBalanceM: 80,
        thresholdM: 30,
      }),
    ).toEqual({
      enabled: true,
      monthlyLimit: null,
      targetBalance: 80_000_000,
      threshold: 30_000_000,
    });
  });

  it('requires the target balance to exceed the trigger threshold', () => {
    expect(
      canSaveAutoTopUpForm({
        enabled: true,
        monthlyLimitM: null,
        targetBalanceM: 40,
        thresholdM: 40,
      }),
    ).toBe(false);
  });
});
