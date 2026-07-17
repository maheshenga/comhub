import { describe, expect, it } from 'vitest';

import { APP_SETTING_KEYS } from '@/server/services/appSettings';

import { buildSystemDefaultsSettings } from './adminReadModel';
import { AppSettingsSnapshot } from './loader';

describe('system defaults admin read model', () => {
  it('preserves persisted user global defaults instead of returning an empty baseline', async () => {
    const storedDefaults = {
      general: { themeMode: 'dark' },
      systemAgent: { inputCompletion: { enabled: true } },
    };
    const snapshot = new AppSettingsSnapshot(
      [APP_SETTING_KEYS.userGlobalSettingsDefaults],
      [{ key: APP_SETTING_KEYS.userGlobalSettingsDefaults, value: storedDefaults }],
    );

    const result = await buildSystemDefaultsSettings(snapshot);

    expect(result.userGlobalSettingsDefaults).toEqual(storedDefaults);
    expect(result.userGlobalSettingsDefaults).not.toEqual({});
  });
});
