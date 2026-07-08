const privateIpv4Patterns = [
  /^10\./,
  /^127\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
];

export function isSafeModuleAppApiUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (host === 'localhost' || host.endsWith('.localhost')) return false;
    if (host === '0.0.0.0') return false;
    if (privateIpv4Patterns.some((pattern) => pattern.test(host))) return false;

    return true;
  } catch {
    return false;
  }
}
