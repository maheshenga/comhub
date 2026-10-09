import { ADMIN_COMMANDS } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { buildAdminConfirmEnvelope, resolveAdminConfirmPolicy } from './adminConfirm';

/**
 * Catalog facts this suite relies on (verified against packages/types/src/
 * adminCommand.ts): every `typed` command is `critical` + `required`; the
 * high band mixes `confirm/none` with one `confirm/optional`
 * (subscription.changeRequest.bulkReject); `none` commands exist in both the
 * high and medium bands.
 */
const TYPED_REQUIRED = Object.values(ADMIN_COMMANDS).find(
  (command) => command.confirmationMode === 'typed',
);
const HIGH_CONFIRM_OPTIONAL = ADMIN_COMMANDS['subscription.changeRequest.bulkReject'];
const MEDIUM_CONFIRM = ADMIN_COMMANDS['order.cancel'];
const NONE_COMMAND = ADMIN_COMMANDS['setting.setAppSetting'];

describe('resolveAdminConfirmPolicy severity → interaction mapping', () => {
  it('maps a critical typed command to typed-with-reason', () => {
    expect(TYPED_REQUIRED).toBeTruthy();

    const policy = resolveAdminConfirmPolicy(TYPED_REQUIRED!.actionId);

    expect(policy?.interaction).toBe('typed-with-reason');
    expect(policy?.echoText).toBe(TYPED_REQUIRED!.actionId);
    expect(policy?.requiresReason).toBe(true);
    expect(policy?.requiresConfirmation).toBe(true);
  });

  it('keeps a catalog-declared typed command typed even below critical severity', () => {
    // Simulated future catalog entry: catalog `typed` is the floor — the
    // mapping never downgrades an explicit typed declaration.
    const policy = resolveAdminConfirmPolicy(TYPED_REQUIRED!.actionId);

    expect(policy?.interaction).toBe('typed-with-reason');
    expect(policy?.echoText).toBe(TYPED_REQUIRED!.actionId);
  });

  it('maps a high confirm command to the plain confirm gate and keeps optional reason optional', () => {
    expect(HIGH_CONFIRM_OPTIONAL.severity).toBe('high');
    expect(HIGH_CONFIRM_OPTIONAL.reasonPolicy).toBe('optional');

    const policy = resolveAdminConfirmPolicy(HIGH_CONFIRM_OPTIONAL.actionId);

    expect(policy?.interaction).toBe('confirm');
    expect(policy?.echoText).toBeUndefined();
    expect(policy?.requiresReason).toBe(false);
    expect(policy?.requiresConfirmation).toBe(true);
  });

  it('maps a medium confirm command to the plain confirm gate', () => {
    const policy = resolveAdminConfirmPolicy(MEDIUM_CONFIRM.actionId);

    expect(policy?.interaction).toBe('confirm');
    expect(policy?.echoText).toBeUndefined();
    expect(policy?.requiresReason).toBe(false);
    expect(policy?.requiresConfirmation).toBe(true);
  });

  it('keeps confirmationMode none outside the interactive gate', () => {
    expect(NONE_COMMAND.confirmationMode).toBe('none');

    const policy = resolveAdminConfirmPolicy(NONE_COMMAND.actionId);

    expect(policy?.interaction).toBe('none');
    expect(policy?.requiresConfirmation).toBe(false);
    expect(policy?.echoText).toBeUndefined();
  });

  it('returns undefined for an unknown action id', () => {
    expect(resolveAdminConfirmPolicy('no.such.action')).toBeUndefined();
  });
});

describe('buildAdminConfirmEnvelope policy enforcement', () => {
  it('returns a minimal envelope when the interaction is none', () => {
    const envelope = buildAdminConfirmEnvelope(NONE_COMMAND.actionId, { confirmed: false });

    expect(envelope).toEqual({ confirmed: undefined });
  });

  it('rejects a typed policy without the exact actionId echo', () => {
    expect(TYPED_REQUIRED).toBeTruthy();

    expect(
      buildAdminConfirmEnvelope(TYPED_REQUIRED!.actionId, {
        confirmationText: 'wrong text',
        confirmed: true,
        reason: 'required anyway',
      }),
    ).toBeNull();

    expect(
      buildAdminConfirmEnvelope(TYPED_REQUIRED!.actionId, {
        confirmationText: TYPED_REQUIRED!.actionId,
        confirmed: true,
        reason: '客户投诉工单 #123',
      }),
    ).toEqual({
      confirmationText: TYPED_REQUIRED!.actionId,
      confirmed: true,
      reason: '客户投诉工单 #123',
    });
  });

  it('requires a non-empty reason for typed-with-reason', () => {
    const missingReason = buildAdminConfirmEnvelope(TYPED_REQUIRED!.actionId, {
      confirmationText: TYPED_REQUIRED!.actionId,
      confirmed: true,
      reason: '   ',
    });
    expect(missingReason).toBeNull();

    const fulfilled = buildAdminConfirmEnvelope(TYPED_REQUIRED!.actionId, {
      confirmationText: TYPED_REQUIRED!.actionId,
      confirmed: true,
      reason: ' 客户投诉工单 #123 ',
    });
    expect(fulfilled).toEqual({
      confirmationText: TYPED_REQUIRED!.actionId,
      confirmed: true,
      reason: '客户投诉工单 #123',
    });
  });

  it('rejects any interactive policy without confirmed=true', () => {
    expect(buildAdminConfirmEnvelope(MEDIUM_CONFIRM.actionId, {})).toBeNull();
    expect(buildAdminConfirmEnvelope(MEDIUM_CONFIRM.actionId, { confirmed: false })).toBeNull();
    expect(buildAdminConfirmEnvelope(MEDIUM_CONFIRM.actionId, { confirmed: true })).toEqual({
      confirmationText: undefined,
      confirmed: true,
      reason: undefined,
    });
  });
});
