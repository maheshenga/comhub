import { describe, expect, it } from 'vitest';

import {
  formatPlatformPluginCredits,
  getPlatformPluginRestrictionCopy,
  isPlatformPluginRunnable,
} from './helpers';

describe('platform plugin marketplace helpers', () => {
  it('returns upgrade guidance for plan denial', () => {
    expect(getPlatformPluginRestrictionCopy('plan_run_denied')).toContain('升级');
  });

  it('returns binding guidance for Agent denial', () => {
    expect(getPlatformPluginRestrictionCopy('agent_not_enabled')).toContain('Agent');
  });

  it('requires visible installable runnable installed state before running', () => {
    expect(
      isPlatformPluginRunnable({
        installed: true,
        planState: { installable: true, runnable: true, visible: true },
      }),
    ).toBe(true);
    expect(
      isPlatformPluginRunnable({
        installed: false,
        planState: { installable: true, runnable: true, visible: true },
      }),
    ).toBe(false);
  });

  it('formats credit values for compact marketplace display', () => {
    expect(formatPlatformPluginCredits(1_500_000)).toBe('1.5M');
    expect(formatPlatformPluginCredits(800)).toBe('800');
  });
});
