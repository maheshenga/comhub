import { describe, expect, it } from 'vitest';

import {
  decryptPlatformPluginSecret,
  encryptPlatformPluginSecret,
  maskPlatformPluginSecret,
  redactPlatformPluginLogValue,
} from './secrets';

describe('platform plugin secret helpers', () => {
  it('encrypts, decrypts, masks, and redacts secret values', () => {
    const key = '0123456789abcdef0123456789abcdef';
    const encrypted = encryptPlatformPluginSecret('ak_live_123456789', key);

    expect(encrypted).not.toContain('ak_live_123456789');
    expect(decryptPlatformPluginSecret(encrypted, key)).toBe('ak_live_123456789');
    expect(maskPlatformPluginSecret('ak_live_123456789')).toBe('ak_l**********6789');
    expect(redactPlatformPluginLogValue({ Authorization: 'Bearer secret-token' })).toEqual({
      Authorization: '[REDACTED]',
    });
  });

  it('redacts nested secret-like log fields without dropping safe metadata', () => {
    expect(
      redactPlatformPluginLogValue({
        headers: {
          'x-api-key': 'live-key',
          accept: 'application/json',
        },
        nested: [{ refreshToken: 'refresh-token' }, { status: 'ok' }],
      }),
    ).toEqual({
      headers: {
        'x-api-key': '[REDACTED]',
        accept: 'application/json',
      },
      nested: [{ refreshToken: '[REDACTED]' }, { status: 'ok' }],
    });
  });
});
