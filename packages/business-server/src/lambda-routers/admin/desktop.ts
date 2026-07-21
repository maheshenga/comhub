import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';
import { getDesktopReleaseDiagnostics } from '@/server/services/desktopRelease';

import { buildDesktopSettings } from '../../appSettings/adminReadModel';
import { loadAppSettingsSectionSnapshot } from '../../appSettings/loader';

const systemReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemRead);

export const adminDesktopRouter = router({
  getOverview: systemReadProcedure.query(async ({ ctx }) => {
    const settings = buildDesktopSettings(
      await loadAppSettingsSectionSnapshot(ctx.serverDB, 'desktop-update'),
    );
    const diagnostics = await getDesktopReleaseDiagnostics({
      baseUrl: settings.desktopUpdateConfig.serverUrl,
    });

    return {
      configuredChannel: settings.desktopUpdateConfig.channel,
      configuredVersion: settings.desktopUpdateConfig.currentVersion || null,
      diagnostics,
    };
  }),
});
