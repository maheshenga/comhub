import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENCRYPTION_PREFIX = 'v1';
const GCM_AUTH_TAG_LENGTH = 16;
const GCM_IV_LENGTH = 12;
const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_LOG_KEY_PATTERN =
  /authorization|api.?key|access.?token|refresh.?token|secret|password|credential|cookie/i;

const resolveSecretKey = (explicitKey?: string) => {
  const key = explicitKey ?? process.env.PLATFORM_PLUGIN_SECRET_KEY;

  if (!key) {
    throw new Error('PLATFORM_PLUGIN_SECRET_KEY_REQUIRED');
  }

  const utf8Key = Buffer.from(key, 'utf8');
  if (utf8Key.length === 32) return utf8Key;

  if (/^[\da-f]{64}$/i.test(key)) {
    return Buffer.from(key, 'hex');
  }

  const base64Key = Buffer.from(key, 'base64');
  if (base64Key.length === 32) return base64Key;

  throw new Error('PLATFORM_PLUGIN_SECRET_KEY_INVALID');
};

export const encryptPlatformPluginSecret = (plainValue: string, key?: string): string => {
  const secretKey = resolveSecretKey(key);
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', secretKey, iv, {
    authTagLength: GCM_AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([cipher.update(plainValue, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
};

export const decryptPlatformPluginSecret = (encryptedValue: string, key?: string): string => {
  const [version, iv, authTag, encrypted] = encryptedValue.split(':');

  if (version !== ENCRYPTION_PREFIX || !iv || !authTag || !encrypted) {
    throw new Error('PLATFORM_PLUGIN_SECRET_PAYLOAD_INVALID');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    resolveSecretKey(key),
    Buffer.from(iv, 'base64url'),
    { authTagLength: GCM_AUTH_TAG_LENGTH },
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

export const maskPlatformPluginSecret = (value: string): string => {
  if (!value) return '';
  if (value.length <= 4) return '*'.repeat(value.length);
  if (value.length <= 8) return `${value.slice(0, 2)}******${value.slice(-2)}`;

  return `${value.slice(0, 4)}**********${value.slice(-4)}`;
};

export const redactPlatformPluginLogValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => redactPlatformPluginLogValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_LOG_KEY_PATTERN.test(key) ? REDACTED_VALUE : redactPlatformPluginLogValue(item),
    ]),
  );
};
