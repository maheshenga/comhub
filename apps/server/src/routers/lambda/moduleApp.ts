import { router } from '@/libs/trpc/lambda';

import { moduleAppCommerceProcedures } from './moduleApp/commerce';
import { moduleAppDataProcedures } from './moduleApp/data';
import { moduleAppInstallationSecretProcedures } from './moduleApp/installationSecrets';
import { moduleAppMarketProcedures } from './moduleApp/market';
import { moduleAppRuntimeProcedures } from './moduleApp/runtime';
import { moduleAppWorkflowProcedures } from './moduleApp/workflow';

export const moduleAppRouter = router({
  ...moduleAppMarketProcedures,
  ...moduleAppRuntimeProcedures,
  ...moduleAppDataProcedures,
  ...moduleAppInstallationSecretProcedures,
  ...moduleAppWorkflowProcedures,
  ...moduleAppCommerceProcedures,
});

export type ModuleAppRouter = typeof moduleAppRouter;
