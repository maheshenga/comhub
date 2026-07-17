import { describe, expect, it } from 'vitest';

import { APP_SETTING_KEYS, getAppSettingsSectionForKey } from './appSettingsRegistry';

describe('app settings section ownership', () => {
  it('assigns user global defaults to system defaults without changing storage ownership', () => {
    expect(getAppSettingsSectionForKey(APP_SETTING_KEYS.userGlobalSettingsDefaults)).toBe(
      'system-defaults',
    );
    expect(getAppSettingsSectionForKey(APP_SETTING_KEYS.storageS3PublicDomain)).toBe(
      'file-storage',
    );
  });
});
