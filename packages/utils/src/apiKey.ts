/**
 * Generate API Key
 * Format: sk-lh-{base64url(32 random bytes)}
 * Uses crypto.getRandomValues for cryptographically secure randomness.
 * Output: 'sk-lh-' (6) + 43 base64url chars = 49 chars total.
 * @returns Generated API Key
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const base64 = btoa(String.fromCodePoint(...bytes));
  // Convert standard base64 to base64url (no padding, URL-safe chars)
  const randomPart = base64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `sk-lh-${randomPart}`;
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
  // Check format: sk-lh-{43 base64url chars} (32 bytes → 43 base64url chars)
  const pattern = /^sk-lh-[\w-]{43}$/;
  return pattern.test(key);
}
