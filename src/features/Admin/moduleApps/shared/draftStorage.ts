const DRAFT_VERSION = 1 as const;
const DRAFT_KEY_PREFIX = `admin-module-app-draft:v${DRAFT_VERSION}:`;
const DRAFT_SCOPE_PATTERN = /^[^/]+\/configuration$|^[^/]+\/entitlements$/;
const SENSITIVE_FIELD_NAMES = new Set([
  'batchid',
  'discrepancyid',
  'discrepancyids',
  'licenseids',
  'offlinerefundreference',
  'orderid',
  'outtradeno',
  'providerrefundid',
  'providertransactionid',
  'refundids',
  'refundreference',
  'requestedamount',
  'revenueentryids',
  'transactionno',
]);
const SENSITIVE_FIELD_PATTERN =
  /alipay|api.?key|bank(?:account|name|number)?|card(?:number)?|credential|evidence|iban|payment|payout|private.?key|recipient|routing(?:number)?|secret|tax(?:id)?|token/i;

export type ModuleDraftView = 'configuration' | 'entitlements';
export type ModuleDraftStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

type ModuleDraftEnvelope<T> = {
  data: T;
  version: typeof DRAFT_VERSION;
};

const getDefaultStorage = (): ModuleDraftStorage | undefined =>
  typeof window === 'undefined' ? undefined : window.localStorage;

const getDraftKey = (scope: string) => {
  if (!DRAFT_SCOPE_PATTERN.test(scope)) {
    throw new TypeError('Module app draft scope must target configuration or entitlements');
  }

  return `${DRAFT_KEY_PREFIX}${scope}`;
};

const hasSensitiveField = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value).some(
    ([key, nestedValue]) =>
      SENSITIVE_FIELD_NAMES.has(key.toLowerCase()) ||
      SENSITIVE_FIELD_PATTERN.test(key) ||
      hasSensitiveField(nestedValue),
  );
};

const assertNoSensitiveFields = (draft: unknown) => {
  if (hasSensitiveField(draft)) {
    throw new TypeError('Sensitive module app draft field cannot be persisted');
  }
};

const serializeDraft = <T>(draft: T) => {
  assertNoSensitiveFields(draft);

  return JSON.stringify({ data: draft, version: DRAFT_VERSION } satisfies ModuleDraftEnvelope<T>);
};

export const createModuleDraftScope = (appId: string, view: ModuleDraftView) => {
  const normalizedAppId = appId.trim();
  if (!normalizedAppId || normalizedAppId.includes('/')) {
    throw new TypeError('Module app draft appId must be non-empty and cannot contain slashes');
  }

  return `${normalizedAppId}/${view}` as const;
};

export const loadModuleDraft = <T>(
  scope: string,
  storage: ModuleDraftStorage | undefined = getDefaultStorage(),
): T | null => {
  if (!storage) return null;

  const key = getDraftKey(scope);
  const stored = storage.getItem(key);
  if (!stored) return null;

  try {
    const envelope = JSON.parse(stored) as Partial<ModuleDraftEnvelope<T>>;
    if (
      !envelope ||
      typeof envelope !== 'object' ||
      envelope.version !== DRAFT_VERSION ||
      !Object.hasOwn(envelope, 'data')
    ) {
      storage.removeItem(key);
      return null;
    }

    if (hasSensitiveField(envelope.data)) {
      storage.removeItem(key);
      return null;
    }

    return envelope.data as T;
  } catch {
    storage.removeItem(key);
    return null;
  }
};

export const saveModuleDraft = <T>(
  scope: string,
  draft: T,
  storage: ModuleDraftStorage | undefined = getDefaultStorage(),
) => {
  if (!storage) return;
  storage.setItem(getDraftKey(scope), serializeDraft(draft));
};

export const clearModuleDraft = (
  scope: string,
  storage: ModuleDraftStorage | undefined = getDefaultStorage(),
) => {
  storage?.removeItem(getDraftKey(scope));
};
