import { router } from '@/libs/trpc/lambda';

import { adminSettingsReadProcedures } from '../../appSettings/readers/adminProcedures';
import { publicSettingsProcedures } from '../../appSettings/readers/publicProcedures';
import { adminSettingsWriteProcedures } from '../../appSettings/writers/adminProcedures';
import { runtimeSettingsWriteProcedures } from '../../appSettings/writers/runtimeProcedures';

export { validateDefaultAgentModelUsability } from '../../appSettings/procedureShared';
export {
  buildUserGlobalSettingsSyncValues,
  syncUserGlobalSettingsDefaultsToUserSettings,
} from '../../appSettings/writers/adminProcedures';

export const adminSettingsRouter = router({
  ...publicSettingsProcedures,
  ...adminSettingsReadProcedures,
  ...adminSettingsWriteProcedures,
  ...runtimeSettingsWriteProcedures,
});
