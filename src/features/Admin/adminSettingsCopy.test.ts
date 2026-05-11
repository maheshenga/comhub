import { describe, expect, it } from 'vitest';

import { SETTINGS_DEFAULT_MODEL_NOTICE, SETTINGS_SUBTITLE } from './adminSettingsCopy';

describe('adminSettingsCopy', () => {
  it('uses current admin module names in the settings page guidance', () => {
    expect(SETTINGS_SUBTITLE).toContain('品牌');
    expect(SETTINGS_SUBTITLE).toContain('默认助手');
    expect(SETTINGS_SUBTITLE).toContain('模型策略和计费矩阵');
    expect(SETTINGS_SUBTITLE).not.toContain('全局计费设置');
  });

  it('explains how default model settings take effect for users', () => {
    expect(SETTINGS_DEFAULT_MODEL_NOTICE).toContain('默认模型');
    expect(SETTINGS_DEFAULT_MODEL_NOTICE).toContain('新注册用户');
    expect(SETTINGS_DEFAULT_MODEL_NOTICE).toContain('已注册用户需要刷新页面');
    expect(SETTINGS_DEFAULT_MODEL_NOTICE).toContain('模型与计费矩阵');
    expect(SETTINGS_DEFAULT_MODEL_NOTICE).toContain('服务商实例');
    expect(SETTINGS_DEFAULT_MODEL_NOTICE).not.toContain('模型与 API');
    expect(SETTINGS_DEFAULT_MODEL_NOTICE).toContain('套餐允许使用');
  });
});
