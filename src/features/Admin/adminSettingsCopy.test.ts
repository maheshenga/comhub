import { describe, expect, it } from 'vitest';

import { SETTINGS_DEFAULT_MODEL_NOTICE, SETTINGS_SUBTITLE } from './adminSettingsCopy';

describe('adminSettingsCopy', () => {
  it('uses current admin module names in the settings page guidance', () => {
    expect(SETTINGS_SUBTITLE).toContain('全局模型策略');
    expect(SETTINGS_SUBTITLE).toContain('全局计费设置');
    expect(SETTINGS_SUBTITLE).toContain('模型与计费矩阵');
    expect(SETTINGS_SUBTITLE).not.toContain('模型策略、计费规则');
  });

  it('keeps default model available in settings while pointing commercial controls to the matrix', () => {
    expect(SETTINGS_DEFAULT_MODEL_NOTICE).toContain('默认模型');
    expect(SETTINGS_DEFAULT_MODEL_NOTICE).toContain('也可在“模型与计费矩阵”中调整');
  });
});
