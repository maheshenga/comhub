import { ADMIN_COMMANDS, type AdminCommandEnvelope, type AdminCommandId } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

const adminCommandEnvelopeSchema = z
  .object({
    actionId: z.string().min(1),
    confirmationText: z.string().max(200).optional(),
    confirmed: z.boolean().optional(),
    reason: z.string().max(500).nullish(),
  })
  .strict();

const commandError = (code: 'BAD_REQUEST' | 'FORBIDDEN', message: string): never => {
  throw new TRPCError({ code, message });
};

export const createAdminCommand = <TActionId extends AdminCommandId>(actionId: TActionId) => {
  const definition = ADMIN_COMMANDS[actionId];
  const validate = (value: unknown) => {
    if (value == null) commandError('BAD_REQUEST', 'ADMIN_COMMAND_REQUIRED');

    const parsed = adminCommandEnvelopeSchema.safeParse(value);
    const envelope: AdminCommandEnvelope = parsed.success
      ? parsed.data
      : commandError('BAD_REQUEST', 'ADMIN_COMMAND_INVALID');
    if (envelope.actionId !== actionId) {
      commandError('FORBIDDEN', 'ADMIN_COMMAND_ACTION_MISMATCH');
    }

    if (definition.confirmationMode !== 'none' && envelope.confirmed !== true) {
      commandError('BAD_REQUEST', 'ADMIN_COMMAND_CONFIRMATION_REQUIRED');
    }

    if (
      definition.confirmationMode === 'typed' &&
      envelope.confirmationText?.trim() !== definition.actionId
    ) {
      commandError('BAD_REQUEST', 'ADMIN_COMMAND_CONFIRMATION_TEXT_MISMATCH');
    }

    const reason = envelope.reason?.trim() || undefined;
    if (definition.reasonPolicy === 'required' && !reason) {
      commandError('BAD_REQUEST', 'ADMIN_COMMAND_REASON_REQUIRED');
    }

    return {
      actionId: definition.actionId,
      auditAction: definition.auditAction,
      reason,
    };
  };

  return {
    definition,
    schema: adminCommandEnvelopeSchema.optional().describe(definition.procedurePath),
    validate,
  };
};
