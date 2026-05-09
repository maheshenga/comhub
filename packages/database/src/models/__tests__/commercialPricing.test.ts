import { describe, expect, it } from 'vitest';

import { resolveAiUsagePricing } from '../commercial';

describe('resolveAiUsagePricing', () => {
  const rules = [
    { group: 'pro', model: 'gpt-test', multiplier: 2, provider: 'newapi' },
    { model: 'gpt-test', multiplier: 1.2, provider: 'newapi' },
  ];

  it('uses the generic model rule when no route group is present', () => {
    expect(
      resolveAiUsagePricing({
        globalMultiplier: 1,
        model: 'gpt-test',
        provider: 'newapi',
        rules,
      }),
    ).toEqual(
      expect.objectContaining({
        matchedRule: expect.objectContaining({ multiplier: 1.2 }),
        multiplier: 1.2,
      }),
    );
  });

  it('uses the group-specific rule when route group matches', () => {
    expect(
      resolveAiUsagePricing({
        globalMultiplier: 1,
        groupKey: 'pro',
        model: 'gpt-test',
        provider: 'newapi',
        rules,
      }),
    ).toEqual(
      expect.objectContaining({
        matchedRule: expect.objectContaining({ group: 'pro', multiplier: 2 }),
        multiplier: 2,
      }),
    );
  });
});
