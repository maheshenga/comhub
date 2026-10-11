import { z } from 'zod';

import { APP_SETTINGS_SECTIONS } from '@/const/appSettingsRegistry';

import { MODULE_APP_RUNTIME_SETTING_KEYS } from '../../module-apps/runtimeConfig';

/**
 * Input schemas for the module-app runtime settings writer, extracted from
 * adminProcedures so the rejection contract has an import-safe test seam
 * (adminProcedures pulls the DB + trpc stack; this module is pure zod).
 */
export const expectedSettingRevisionsSchema = z.partialRecord(
  z.enum(APP_SETTINGS_SECTIONS),
  z.number().int().nonnegative(),
);

export const moduleAppRuntimeSettingUpdateSchema = z.object({
  key: z.enum(MODULE_APP_RUNTIME_SETTING_KEYS),
  value: z.unknown(),
});

export const setModuleAppRuntimeSettingsInputSchema = z.object({
  expectedRevisions: expectedSettingRevisionsSchema,
  updates: z.array(moduleAppRuntimeSettingUpdateSchema).min(1).max(100),
});
