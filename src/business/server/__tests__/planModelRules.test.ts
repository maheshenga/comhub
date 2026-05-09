import { describe, expect, it } from 'vitest';

import { isModelAllowedByPlanRules } from '../planModelRules';

describe('plan model rules', () => {
  it('allows exact group-qualified model entries', () => {
    const rules = {
      chat: {
        allowlist: ['pro:gpt-4o'],
        mode: 'allowlist' as const,
      },
    };

    expect(isModelAllowedByPlanRules(rules, 'gpt-4o', 'chat', 'pro')).toBe(true);
    expect(isModelAllowedByPlanRules(rules, 'gpt-4o', 'chat', 'default')).toBe(false);
  });

  it('supports group and model wildcards in qualified entries', () => {
    expect(
      isModelAllowedByPlanRules(
        { chat: { allowlist: ['*:gpt-4o'], mode: 'allowlist' } },
        'gpt-4o',
        'chat',
        'vip',
      ),
    ).toBe(true);

    expect(
      isModelAllowedByPlanRules(
        { chat: { allowlist: ['pro:*'], mode: 'allowlist' } },
        'claude-3-5-sonnet',
        'chat',
        'pro',
      ),
    ).toBe(true);
  });

  it('keeps legacy unqualified model entries working', () => {
    const rules = {
      chat: {
        allowlist: ['gpt-4o'],
        mode: 'allowlist' as const,
      },
    };

    expect(isModelAllowedByPlanRules(rules, 'gpt-4o', 'chat', 'pro')).toBe(true);
  });

  it('blocks only matching group-qualified entries in blocklist mode', () => {
    const rules = {
      chat: {
        blocklist: ['pro:gpt-4o'],
        mode: 'blocklist' as const,
      },
    };

    expect(isModelAllowedByPlanRules(rules, 'gpt-4o', 'chat', 'pro')).toBe(false);
    expect(isModelAllowedByPlanRules(rules, 'gpt-4o', 'chat', 'vip')).toBe(true);
  });
});
