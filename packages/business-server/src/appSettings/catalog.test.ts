import { describe, expect, it } from 'vitest';

import { APP_SETTING_KEYS } from '@/server/services/appSettings';

import {
  APP_SETTINGS_CATALOG,
  APP_SETTINGS_SECTION_KEYS,
  WRITABLE_APP_SETTING_KEYS,
} from './catalog';

describe('APP_SETTINGS_CATALOG', () => {
  it('gives every registered setting one owner and complete active editable governance', () => {
    const registeredKeys = Object.values(APP_SETTING_KEYS).sort();
    const catalogKeys = APP_SETTINGS_CATALOG.map((item) => item.key).sort();

    expect(catalogKeys).toEqual(registeredKeys);
    expect(new Set(catalogKeys).size).toBe(catalogKeys.length);

    for (const setting of APP_SETTINGS_CATALOG) {
      expect(setting.defaultSource).toBeTruthy();
      expect(setting.effectiveSource).toBeTruthy();
      expect(setting.auditPolicy).toBeTruthy();
      expect(setting.cacheScopes).toContain('app-settings');
      expect(setting.section).toBeTruthy();
      expect(setting.valueSchema).toBeTruthy();

      if (setting.lifecycle === 'active' && setting.writable) {
        expect(setting.runtimeConsumers.length).toBeGreaterThan(0);
      }

      if (setting.ownership === 'external') {
        expect(setting.writable).toBe(false);
        expect(setting.lifecycle).toBe('external');
      }
    }

    expect(APP_SETTINGS_SECTION_KEYS.notifications).toContain(
      APP_SETTING_KEYS.notificationRetentionDays,
    );
    expect(
      Object.values(APP_SETTINGS_SECTION_KEYS).filter((keys) =>
        keys.includes(APP_SETTING_KEYS.notificationRetentionDays),
      ),
    ).toHaveLength(1);
    expect(WRITABLE_APP_SETTING_KEYS).not.toContain(APP_SETTING_KEYS.desktopOssAccessKeySecret);
  });
});
