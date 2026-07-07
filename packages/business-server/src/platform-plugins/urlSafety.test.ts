import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertSafePlatformPluginUrl } from './urlSafety';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

const lookupMock = vi.mocked(lookup);

const mockLookupAddresses = (addresses: LookupAddress[]) => {
  lookupMock.mockResolvedValue(addresses as never);
};

afterEach(() => {
  vi.clearAllMocks();
});

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
  ])('rejects unsafe URL %s', async (url) => {
    await expect(assertSafePlatformPluginUrl(url)).rejects.toThrow();
  });

  it('accepts public http and https URLs', async () => {
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }]);

    await expect(
      assertSafePlatformPluginUrl('https://api.dictionaryapi.dev/api/v2/entries/en/test'),
    ).resolves.toBe(
      'https://api.dictionaryapi.dev/api/v2/entries/en/test',
    );
  });

  it('rejects default runtime resolver results that point at private targets', async () => {
    mockLookupAddresses([{ address: '127.0.0.1', family: 4 }]);

    await expect(assertSafePlatformPluginUrl('http://127.0.0.1.nip.io/api')).rejects.toThrow();
  });

  it('fails closed when the default resolver cannot resolve a hostname', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'));

    await expect(assertSafePlatformPluginUrl('https://example.invalid/api')).rejects.toThrow();
  });

  it.each([
    ['http://127.0.0.1.nip.io/api', '127.0.0.1'],
    ['http://localhost.nip.io/api', '127.0.0.1'],
    ['http://169.254.169.254.nip.io/latest/meta-data', '169.254.169.254'],
  ])('rejects resolver-injected private or metadata target %s', async (url, resolvedAddress) => {
    await expect(
      assertSafePlatformPluginUrl(url, {
        resolveHostname: () => [resolvedAddress],
      }),
    ).rejects.toThrow();
  });

  it('accepts public resolver results', async () => {
    await expect(
      assertSafePlatformPluginUrl('https://example.com/api', {
        resolveHostname: () => ['93.184.216.34'],
      }),
    ).resolves.toBe('https://example.com/api');
  });
});
