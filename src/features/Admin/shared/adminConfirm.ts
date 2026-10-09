import type { AdminCommandDefinition, AdminCommandEnvelope } from '@lobechat/types';
import { getAdminCommandDefinition } from '@lobechat/types';

/**
 * Severity → interaction-strength mapping for Admin confirmations
 * (blueprint §4.3): `critical` = typed confirmation + mandatory reason,
 * `medium` = plain confirm. The blueprint's literal `high = typed` band is
 * NOT realized by the merged M4 catalog (§6.3): no `high` command declares
 * `confirmationMode: 'typed'` — the high band mixes `confirm` and `none`
 * (plus one `confirm`/optional-reason, subscription.changeRequest.bulkReject)
 * — so `high` resolves to the plain confirm gate here. Behavior is pinned to
 * the catalog grades (enforced by validateAdminDangerousActionConfirmation
 * server-side); revisit if the catalog ever grades a `high` command `typed`.
 * Commands declared `confirmationMode: 'none'` skip the interactive gate
 * entirely and are flagged in the resolved policy so callers can show a
 * single-step button.
 *
 * This is the page-facing twin of `adminDangerousActions.ts` (which validates
 * envelope payloads against the same catalog): resolve the policy here, then
 * validate through `validateAdminDangerousActionConfirmation` at submit time.
 */
export type AdminConfirmInteraction =
  /** typed confirmation + required reason (actionId echo + non-empty reason). */
  | 'typed-with-reason'
  /** typed confirmation (actionId echo), reason stays optional/absent. */
  | 'typed'
  /** plain confirm dialog, no text input. */
  | 'confirm'
  /** no interactive gate (confirmationMode 'none'). */
  | 'none';

export interface AdminConfirmPolicy {
  /** Human copy for the confirm step; falls back to the command definition. */
  description: string;
  /** What the user must type to unlock a typed confirmation; undefined otherwise. */
  echoText?: string;
  /** Resolved interaction strength for the current severity + catalog entry. */
  interaction: AdminConfirmInteraction;
  /** True when the caller must pass `confirmed: true` in the envelope. */
  requiresConfirmation: boolean;
  /** True when the caller must pass a non-empty `reason` in the envelope. */
  requiresReason: boolean;
  title: string;
}

/**
 * Resolve the confirmation policy for a catalog action. Unknown action ids
 * resolve to `undefined` so callers can render nothing instead of guessing.
 *
 * Precedence rules (blueprint §4.3):
 * - catalog `confirmationMode: 'none'` keeps the command outside the
 *   interactive gate;
 * - catalog `confirmationMode: 'typed'` is the floor — the gate stays typed
 *   (plus reason when the policy requires one) regardless of severity;
 * - otherwise severity drives the gate: `critical` escalates to
 *   typed-with-reason, `high`/`medium` get the plain confirm dialog.
 */
export const resolveAdminConfirmPolicy = (actionId: string): AdminConfirmPolicy | undefined => {
  const definition = getAdminCommandDefinition(actionId);
  if (!definition) return undefined;

  // Explicitly-typed copies keep the full union: the literal narrowing on
  // `definition` reflects today's catalog shape (every `typed` command is
  // `critical` + `required`), which would mark the severity/reason fallbacks
  // below as dead comparisons. They are a runtime guard for catalog entries
  // added later (e.g. a `critical` command declared `confirm`-only).
  const severity: AdminCommandDefinition['severity'] = definition.severity;
  const reasonPolicy: AdminCommandDefinition['reasonPolicy'] = definition.reasonPolicy;
  const typedByCatalog = definition.confirmationMode === 'typed';
  const noneByCatalog = definition.confirmationMode === 'none';

  const interaction: AdminConfirmInteraction = noneByCatalog
    ? 'none'
    : typedByCatalog
      ? reasonPolicy === 'required'
        ? 'typed-with-reason'
        : 'typed'
      : severity === 'critical' || reasonPolicy === 'required'
        ? 'typed-with-reason'
        : 'confirm';

  return {
    description: definition.description,
    echoText: interaction === 'typed' || interaction === 'typed-with-reason' ? actionId : undefined,
    interaction,
    requiresConfirmation: interaction !== 'none',
    requiresReason: reasonPolicy === 'required' || interaction === 'typed-with-reason',
    title: definition.title,
  };
};

/**
 * Build the envelope fragment a page must merge into the mutation input for
 * the resolved policy: `confirmed` for any interactive gate, the actionId echo
 * for typed gates and the trimmed reason when the policy demands one.
 * Returns `null` when the policy is unmet so callers can abort the mutation.
 */
export const buildAdminConfirmEnvelope = (
  actionId: string,
  input: { confirmationText?: string; confirmed?: boolean; reason?: null | string } = {},
): Pick<AdminCommandEnvelope, 'confirmationText' | 'confirmed' | 'reason'> | null => {
  const policy = resolveAdminConfirmPolicy(actionId);
  if (!policy) return null;

  if (policy.interaction === 'none') return { confirmed: undefined };

  const confirmed = input.confirmed === true;
  const echoMatches = policy.echoText == null || input.confirmationText?.trim() === policy.echoText;
  const reason = policy.requiresReason ? input.reason?.trim() || undefined : undefined;

  if (!confirmed || !echoMatches || (policy.requiresReason && !reason)) return null;

  return {
    confirmationText: policy.echoText == null ? undefined : input.confirmationText?.trim(),
    confirmed,
    reason,
  };
};
