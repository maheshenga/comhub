export type AuditEnvelopeStatus = 'failed' | 'started' | 'succeeded';

export type AuditEnvelope = {
  action: string;
  actorUserId: null | string;
  clientIp: null | string;
  correlationId: string;
  resourceId: null | string;
  resourceType: null | string;
  status: AuditEnvelopeStatus;
  targetUserId: null | string;
};

const SENSITIVE_AUDIT_FIELD = /authorization|certificate|cookie|key|password|secret|token/i;
const REDACTED_VALUE = '[REDACTED]';

export const redactAuditValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactAuditValue);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_AUDIT_FIELD.test(key) ? REDACTED_VALUE : redactAuditValue(nestedValue),
    ]),
  );
};

export const createAuditEnvelope = (params: {
  audit: AuditEnvelope;
  payload?: null | Record<string, unknown>;
}): Record<string, unknown> => ({
  ...(redactAuditValue(params.payload ?? {}) as Record<string, unknown>),
  audit: params.audit,
});

export const readAuditEnvelope = (value: unknown): AuditEnvelope | null => {
  if (!value || typeof value !== 'object') return null;

  const audit = (value as { audit?: unknown }).audit;
  if (!audit || typeof audit !== 'object') return null;

  return audit as AuditEnvelope;
};
