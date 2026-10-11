import { describe, expect, it } from 'vitest';

import { MODULE_APP_RUNTIME_SETTING_KEYS } from '../../module-apps/runtimeConfig';
import { setModuleAppRuntimeSettingsInputSchema } from './setModuleAppRuntimeSettingsInput';

const buildInput = (overrides: Record<string, unknown> = {}) => ({
  expectedRevisions: {},
  updates: [{ key: MODULE_APP_RUNTIME_SETTING_KEYS[0], value: true }],
  ...overrides,
});

// PP-06 review follow-up (#6): the writer's input contract had no direct
// unit test — only the structure test asserted the procedure's existence.
describe('setModuleAppRuntimeSettings input schema rejection', () => {
  it('accepts a minimal valid payload and every runtime setting key', () => {
    expect(setModuleAppRuntimeSettingsInputSchema.safeParse(buildInput()).success).toBe(true);

    for (const key of MODULE_APP_RUNTIME_SETTING_KEYS) {
      expect(
        setModuleAppRuntimeSettingsInputSchema.safeParse(buildInput({ updates: [{ key, value: null }] }))
          .success,
        key,
      ).toBe(true);
    }
  });

  it('rejects updates keyed outside MODULE_APP_RUNTIME_SETTING_KEYS', () => {
    const result = setModuleAppRuntimeSettingsInputSchema.safeParse(
      buildInput({ updates: [{ key: 'not.a.runtime.setting', value: true }] }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects empty and oversized update batches', () => {
    expect(setModuleAppRuntimeSettingsInputSchema.safeParse(buildInput({ updates: [] })).success).toBe(
      false,
    );
    expect(
      setModuleAppRuntimeSettingsInputSchema.safeParse(
        buildInput({
          updates: Array.from({ length: 101 }, () => ({
            key: MODULE_APP_RUNTIME_SETTING_KEYS[0],
            value: true,
          })),
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects malformed expectedRevisions', () => {
    // Revisions are non-negative integers per section.
    expect(
      setModuleAppRuntimeSettingsInputSchema.safeParse(
        buildInput({ expectedRevisions: { moduleApps: -1 } }),
      ).success,
    ).toBe(false);
    expect(
      setModuleAppRuntimeSettingsInputSchema.safeParse(
        buildInput({ expectedRevisions: { moduleApps: 1.5 } }),
      ).success,
    ).toBe(false);
    // Unknown section keys do not match the enum.
    expect(
      setModuleAppRuntimeSettingsInputSchema.safeParse(
        buildInput({ expectedRevisions: { notASection: 1 } }),
      ).success,
    ).toBe(false);
    // The field itself is required.
    expect(
      setModuleAppRuntimeSettingsInputSchema.safeParse({
        updates: [{ key: MODULE_APP_RUNTIME_SETTING_KEYS[0], value: true }],
      }).success,
    ).toBe(false);
  });
});
