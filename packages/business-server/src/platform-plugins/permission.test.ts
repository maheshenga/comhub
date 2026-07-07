import { describe, expect, it } from 'vitest';

import { resolvePlatformPluginPermission } from './permission';

describe('resolvePlatformPluginPermission', () => {
  it('separates visible, installable, and runnable permission levels', () => {
    const result = resolvePlatformPluginPermission({
      agentBound: true,
      entitlement: {
        discountPercent: 0,
        freeQuotaCredits: 0,
        installable: true,
        plan: 'pro',
        runnable: false,
        visible: true,
      },
      installed: true,
      pluginStatus: 'published',
    });

    expect(result.visible.allowed).toBe(true);
    expect(result.installable.allowed).toBe(true);
    expect(result.runnable.allowed).toBe(false);
    expect(result.runnable.reason).toBe('plan_run_denied');
  });

  it('denies unpublished plugins at every level', () => {
    const result = resolvePlatformPluginPermission({
      agentBound: false,
      entitlement: null,
      installed: false,
      pluginStatus: 'draft',
    });

    expect(result.visible.reason).toBe('plugin_not_published');
    expect(result.installable.reason).toBe('plugin_not_published');
    expect(result.runnable.reason).toBe('plugin_not_published');
  });

  it('requires installation before a plugin can run', () => {
    const result = resolvePlatformPluginPermission({
      agentBound: true,
      entitlement: {
        discountPercent: 0,
        freeQuotaCredits: 0,
        installable: true,
        plan: 'pro',
        runnable: true,
        visible: true,
      },
      installed: false,
      pluginStatus: 'published',
    });

    expect(result.visible.allowed).toBe(true);
    expect(result.installable.allowed).toBe(true);
    expect(result.runnable.allowed).toBe(false);
    expect(result.runnable.reason).toBe('not_installed');
  });

  it('requires agent binding before a plugin can run', () => {
    const result = resolvePlatformPluginPermission({
      agentBound: false,
      entitlement: {
        discountPercent: 0,
        freeQuotaCredits: 0,
        installable: true,
        plan: 'pro',
        runnable: true,
        visible: true,
      },
      installed: true,
      pluginStatus: 'published',
    });

    expect(result.runnable.allowed).toBe(false);
    expect(result.runnable.reason).toBe('agent_not_enabled');
  });
});
