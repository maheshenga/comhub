import { describe, expect, it } from 'vitest';

import { assertSafePlatformPluginUrl } from './urlSafety';

describe('assertSafePlatformPluginUrl', () => {
  it.each([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://10.0.0.1',
    'http://172.16.0.1',
    'http://172.31.255.255',
    'http://192.168.1.1',
    'http://169.254.169.254',
    'http://[::1]',
    'file:///etc/passwd',
  ])('rejects unsafe URL %s', (url) => {
    expect(() => assertSafePlatformPluginUrl(url)).toThrow();
  });

  it('accepts public http and https URLs', () => {
    expect(assertSafePlatformPluginUrl('https://api.dictionaryapi.dev/api/v2/entries/en/test')).toBe(
      'https://api.dictionaryapi.dev/api/v2/entries/en/test',
    );
  });

  it.each([
    ['http://127.0.0.1.nip.io/api', '127.0.0.1'],
    ['http://localhost.nip.io/api', '127.0.0.1'],
    ['http://169.254.169.254.nip.io/latest/meta-data', '169.254.169.254'],
  ])('rejects resolver-injected private or metadata target %s', (url, resolvedAddress) => {
    expect(() =>
      assertSafePlatformPluginUrl(url, {
        resolveHostname: () => [resolvedAddress],
      }),
    ).toThrow();
  });

  it('accepts public resolver results', () => {
    expect(
      assertSafePlatformPluginUrl('https://example.com/api', {
        resolveHostname: () => ['93.184.216.34'],
      }),
    ).toBe('https://example.com/api');
  });
});
