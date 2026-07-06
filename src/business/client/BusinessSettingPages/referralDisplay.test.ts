import { describe, expect, it } from 'vitest';

import { normalizeReferralCodeInput } from './referralDisplay';

describe('referral display helpers', () => {
  it('extracts a seven digit referral code from plain text', () => {
    expect(normalizeReferralCodeInput(' 78790097 ')).toBe('7879009');
    expect(normalizeReferralCodeInput('ref: 123-456-789')).toBe('1234567');
  });

  it('extracts referral codes from shared signup links', () => {
    expect(normalizeReferralCodeInput('https://chat.example.com/signup?ref=7654321')).toBe(
      '7654321',
    );
    expect(
      normalizeReferralCodeInput('https://chat.example.com/signup?referral=1112223&utm=test'),
    ).toBe('1112223');
  });

  it('returns an empty string when a link has no referral parameter', () => {
    expect(normalizeReferralCodeInput('https://chat.example.com/signup?utm=test')).toBe('');
  });
}
);
