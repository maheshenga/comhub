import { randomBytes } from 'node:crypto';

const API_KEY_PREFIX = 'sk-lh-';
const API_KEY_RANDOM_BYTES = 32;
const LEGACY_API_KEY_PATTERN = /^sk-lh-[\da-z]{16}$/;
const SECURE_API_KEY_PATTERN = /^sk-lh-[\da-f]{64}$/;

/**
 * Generate API Key
 * Format: sk-lh-{random}
 * @returns Generated API Key
 */
export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(API_KEY_RANDOM_BYTES).toString('hex')}`;
}

/**
 * Check if API Key is expired
 * @param expiresAt - Expiration time
 * @returns Whether the key has expired
 */
export function isApiKeyExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date() > expiresAt;
}

/**
 * Validate API Key format
 * @param key - API Key to validate
 * @returns Whether the key has a valid format
 */
export function validateApiKeyFormat(key: string): boolean {
  return LEGACY_API_KEY_PATTERN.test(key) || SECURE_API_KEY_PATTERN.test(key);
}
