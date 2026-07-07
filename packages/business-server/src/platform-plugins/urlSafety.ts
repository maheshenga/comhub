import { isIP } from 'node:net';

export type PlatformPluginUrlResolver = (hostname: string) => readonly string[];

export interface PlatformPluginUrlSafetyOptions {
  resolveHostname?: PlatformPluginUrlResolver;
}

const unsafeUrlError = () => new Error('PLATFORM_PLUGIN_UNSAFE_URL');

const stripIpv6Brackets = (hostname: string) =>
  hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

const parseIpv4Octets = (address: string) => {
  const octets = address.split('.').map((value) => Number(value));

  if (
    octets.length !== 4 ||
    octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return null;
  }

  return octets;
};

const isUnsafeIpv4 = (address: string) => {
  const octets = parseIpv4Octets(address);

  if (!octets) return false;

  const [a, b] = octets;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;

  return a >= 224;
};

const parseIpv6Address = (address: string) => {
  const normalizedAddress = address.toLowerCase();
  const ipv4TailMatch = normalizedAddress.match(/(\d+\.\d+\.\d+\.\d+)$/);
  let expandedAddress = normalizedAddress;

  if (ipv4TailMatch) {
    const octets = parseIpv4Octets(ipv4TailMatch[1]);
    if (!octets) return null;

    const [a, b, c, d] = octets;
    expandedAddress = `${normalizedAddress.slice(0, ipv4TailMatch.index)}${(
      (a << 8) |
      b
    ).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const parts = expandedAddress.split('::');

  if (parts.length > 2) return null;

  const leftParts = parts[0] ? parts[0].split(':').filter(Boolean) : [];
  const rightParts = parts[1] ? parts[1].split(':').filter(Boolean) : [];
  const hextetCount = leftParts.length + rightParts.length;

  if (parts.length === 1 && hextetCount !== 8) return null;
  if (parts.length === 2 && hextetCount >= 8) return null;

  const hextets = [
    ...leftParts,
    ...Array.from({ length: 8 - hextetCount }, () => '0'),
    ...rightParts,
  ];

  if (hextets.length !== 8) return null;

  let value = 0n;

  for (const hextet of hextets) {
    if (!/^[\da-f]{1,4}$/.test(hextet)) return null;

    value = (value << 16n) + BigInt(Number.parseInt(hextet, 16));
  }

  return value;
};

const isUnsafeIpv6 = (address: string) => {
  const normalizedAddress = stripIpv6Brackets(address.toLowerCase());

  if (normalizedAddress === '::' || normalizedAddress === '::1') return true;
  if (normalizedAddress.includes('::ffff:')) return true;

  const value = parseIpv6Address(normalizedAddress);

  if (value === null) return false;

  const unsafeRanges = [
    [0n, 1n],
    [0xfc00_0000_0000_0000_0000_0000_0000_0000n, 0xfdff_ffff_ffff_ffff_ffff_ffff_ffff_ffffn],
    [0xfe80_0000_0000_0000_0000_0000_0000_0000n, 0xfebf_ffff_ffff_ffff_ffff_ffff_ffff_ffffn],
    [0xff00_0000_0000_0000_0000_0000_0000_0000n, 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_ffffn],
  ] as const;

  return unsafeRanges.some(([start, end]) => value >= start && value <= end);
};

const isUnsafeIpAddress = (address: string) => {
  const normalizedAddress = stripIpv6Brackets(address.toLowerCase());
  const ipVersion = isIP(normalizedAddress);

  if (ipVersion === 4) return isUnsafeIpv4(normalizedAddress);
  if (ipVersion === 6) return isUnsafeIpv6(normalizedAddress);

  return true;
};

const assertSafeHostname = (hostname: string) => {
  const normalizedHostname = hostname.toLowerCase();
  const hostWithoutBrackets = stripIpv6Brackets(normalizedHostname);

  if (!normalizedHostname) throw unsafeUrlError();
  if (normalizedHostname === 'localhost' || normalizedHostname.endsWith('.localhost')) {
    throw unsafeUrlError();
  }

  const ipVersion = isIP(hostWithoutBrackets);
  if (ipVersion && isUnsafeIpAddress(hostWithoutBrackets)) {
    throw unsafeUrlError();
  }
};

export const assertSafePlatformPluginUrl = (
  value: string,
  options: PlatformPluginUrlSafetyOptions = {},
): string => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw unsafeUrlError();
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw unsafeUrlError();
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw unsafeUrlError();
  }

  assertSafeHostname(parsedUrl.hostname);

  const resolvedAddresses = options.resolveHostname?.(parsedUrl.hostname) ?? [];

  for (const address of resolvedAddresses) {
    if (isUnsafeIpAddress(address)) {
      throw unsafeUrlError();
    }
  }

  return parsedUrl.toString();
};
