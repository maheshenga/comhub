import { describe, expect, it } from 'vitest';

import { buildReferralLink } from './shared';

describe('business subscription shared helpers', () => {
  it('builds official-style referral links for the user referral page', () => {
    expect(buildReferralLink('https://app.example.com', '1234567')).toBe(
      'https://app.example.com/signin?referral=1234567',
    );
  });

  it('encodes referral codes in referral links', () => {
    expect(buildReferralLink('https://app.example.com/', '12 34')).toBe(
      'https://app.example.com/signin?referral=12%2034',
    );
  });
});
