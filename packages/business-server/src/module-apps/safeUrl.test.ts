import { describe, expect, it } from 'vitest';

import { isSafeModuleAppApiUrl } from './safeUrl';

describe('isSafeModuleAppApiUrl', () => {
  it('allows public https urls', () => {
    expect(isSafeModuleAppApiUrl('https://api.example.com/run')).toBe(true);
  });

  it('blocks localhost and private networks', () => {
    expect(isSafeModuleAppApiUrl('http://localhost:3000')).toBe(false);
    expect(isSafeModuleAppApiUrl('http://127.0.0.1:3000')).toBe(false);
    expect(isSafeModuleAppApiUrl('http://10.0.0.2/run')).toBe(false);
    expect(isSafeModuleAppApiUrl('ftp://api.example.com/run')).toBe(false);
  });
});
