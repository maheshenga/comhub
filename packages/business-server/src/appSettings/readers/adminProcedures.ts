import { z } from 'zod';

import { APP_SETTINGS_SECTIONS } from '@/const/appSettingsRegistry';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure } from '@/libs/trpc/lambda';
import { getServerDefaultAgentConfig } from '@/server/globalConfig';
import { buildAppSettingsGovernance } from '@/server/services/appSettings/governance';
import { getAllEnabledModels } from '@/server/services/newapiInstance';

import { buildAdminSettingsReadModel, buildAdminSettingsSectionReadModel } from '../adminReadModel';
import { loadAllAppSettingsSnapshot, loadAppSettingsSectionSnapshot } from '../loader';
import { SETTING_KEYS, toString, validateDefaultAgentModelUsability } from '../procedureShared';

const systemReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemRead);

export const adminSettingsReadProcedures = {
  getGovernance: systemReadProcedure.query(async ({ ctx }) => {
    const rows = await ctx.serverDB.query.appSettings.findMany({
      columns: {
        key: true,
        updatedAt: true,
        value: true,
      },
    });

    return buildAppSettingsGovernance(rows);
  }),
  getSection: systemReadProcedure
    .input(z.object({ section: z.enum(APP_SETTINGS_SECTIONS) }))
    .query(async ({ ctx, input }) => {
      const needsEnabledModels =
        input.section === 'model-policy' || input.section === 'system-defaults';
      const [snapshot, enabledModels] = await Promise.all([
        loadAppSettingsSectionSnapshot(ctx.serverDB, input.section),
        needsEnabledModels ? getAllEnabledModels(ctx.serverDB) : Promise.resolve([]),
      ]);

      return buildAdminSettingsSectionReadModel(input.section, snapshot, {
        defaultAgentConfig: getServerDefaultAgentConfig(),
        enabledModels,
      });
    }),
  getAll: systemReadProcedure.query(async ({ ctx }) => {
    const [snapshot, enabledModels] = await Promise.all([
      loadAllAppSettingsSnapshot(ctx.serverDB),
      getAllEnabledModels(ctx.serverDB),
    ]);

    return buildAdminSettingsReadModel(snapshot, {
      defaultAgentConfig: getServerDefaultAgentConfig(),
      enabledModels,
    });
  }),
  validateDefaultAgentSettings: systemReadProcedure
    .input(
      z.object({
        model: z.string().optional(),
        modelType: z.enum(['chat', 'image', 'video']).optional(),
        provider: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const modelType = input.modelType ?? 'chat';
      const keys =
        modelType === 'image'
          ? {
              modelKey: SETTING_KEYS.defaultImageModel,
              providerKey: SETTING_KEYS.defaultImageProvider,
            }
          : modelType === 'video'
            ? {
                modelKey: SETTING_KEYS.defaultVideoModel,
                providerKey: SETTING_KEYS.defaultVideoProvider,
              }
            : {
                modelKey: SETTING_KEYS.defaultAgentModel,
                providerKey: SETTING_KEYS.defaultAgentProvider,
              };

      await validateDefaultAgentModelUsability(
        ctx.serverDB,
        {
          [keys.modelKey]: toString(input.model),
          [keys.providerKey]: toString(input.provider),
        },
        { ...keys, modelType },
      );

      return { ok: true };
    }),
} as const;
