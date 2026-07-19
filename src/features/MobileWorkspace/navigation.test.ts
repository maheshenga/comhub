import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MOBILE_CONFIG,
  type MobilePublicConfigV1,
  normalizeMobileConfig,
} from '@/const/mobileConfig';

import { resolveMobileActiveSlot, shouldShowMobileTabBar } from './navigation';

const configWithNavigation = (
  patches: Partial<MobilePublicConfigV1['navigation']['items'][number]>[],
) =>
  normalizeMobileConfig({
    ...DEFAULT_MOBILE_CONFIG,
    navigation: {
      items: DEFAULT_MOBILE_CONFIG.navigation.items.map((item, index) => ({
        ...item,
        ...patches[index],
      })),
    },
  });

describe('mobile workspace navigation', () => {
  it('resolves default root and deep community routes to stable slots', () => {
    expect(resolveMobileActiveSlot('/', DEFAULT_MOBILE_CONFIG)).toBe('slot-1');
    expect(resolveMobileActiveSlot('/community/agent/demo', DEFAULT_MOBILE_CONFIG)).toBe('slot-3');
  });

  it('respects renamed, reordered, and custom valid tab paths', () => {
    const config = configWithNavigation([
      { label: 'Inbox', order: 4 },
      { label: 'Create', order: 3, path: '/create-mobile' },
      { label: 'Explore', order: 1, path: '/explore' },
      { label: 'Tools', order: 2, path: '/tools' },
    ]);

    expect(resolveMobileActiveSlot('/explore', config)).toBe('slot-3');
    expect(resolveMobileActiveSlot('/tools/detail', config)).toBe('slot-4');
    expect(shouldShowMobileTabBar('/explore', config)).toBe(true);
  });

  it('falls back to the first visible configured slot when a matched slot is hidden', () => {
    const config = configWithNavigation([
      { order: 2 },
      { order: 3 },
      { order: 1, visible: false },
      { order: 4 },
    ]);

    expect(resolveMobileActiveSlot('/community', config)).toBe('slot-1');
  });

  it('shows the tab bar only on top-level mobile workspace pages', () => {
    expect(shouldShowMobileTabBar('/')).toBe(true);
    expect(shouldShowMobileTabBar('/design')).toBe(true);
    expect(shouldShowMobileTabBar('/discover')).toBe(true);
    expect(shouldShowMobileTabBar('/apps')).toBe(true);
    expect(shouldShowMobileTabBar('/community/agent')).toBe(true);
    expect(shouldShowMobileTabBar('/agent/a/topic')).toBe(false);
    expect(shouldShowMobileTabBar('/community/agent/demo')).toBe(false);
    expect(shouldShowMobileTabBar('/settings')).toBe(false);
  });
});
