import type { ModuleAppCapabilityClaims } from '@lobechat/types';

import { ModuleAppDataService } from '@/business/server/module-apps/data/service';
import { ModuleAppFileGateway } from '@/business/server/module-apps/sdk/files';
import {
  ModuleAppCapabilityGateway,
  ModuleAppReplayGuard,
} from '@/business/server/module-apps/sdk/gateway';
import { ModuleAppHttpGateway } from '@/business/server/module-apps/sdk/http';
import {
  ModuleAppNotificationGateway,
  ModuleAppNotificationRateLimiter,
} from '@/business/server/module-apps/sdk/notifications';
import { ModuleAppSecretsGateway } from '@/business/server/module-apps/sdk/secrets';
import { ModuleAppTaskService } from '@/business/server/module-apps/workflows/taskService';
import { ModuleAppModel } from '@/database/models/moduleApp';
import { ModuleAppDataModel } from '@/database/models/moduleAppData';
import { ModuleAppWorkflowModel } from '@/database/models/moduleAppWorkflow';
import { NotificationModel } from '@/database/models/notification';
import { WorkspaceMemberModel } from '@/database/models/workspaceMember';
import type { LobeChatDatabase } from '@/database/type';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { FileS3 } from '@/server/modules/S3';

import {
  createModuleAppNotificationRateLimitBackend,
  createModuleAppReplayGuardBackend,
} from './distributedGuards';

const replayGuard = new ModuleAppReplayGuard({
  backend: createModuleAppReplayGuardBackend(),
});
const notificationRateLimiter = new ModuleAppNotificationRateLimiter({
  backend: createModuleAppNotificationRateLimitBackend(),
});

const resolveOutboundHosts = (runtimeManifest: unknown) => {
  if (!runtimeManifest || typeof runtimeManifest !== 'object' || !('runtime' in runtimeManifest)) {
    return [];
  }
  const runtime = runtimeManifest.runtime;
  if (!runtime || typeof runtime !== 'object' || !('outboundHosts' in runtime)) return [];

  return Array.isArray(runtime.outboundHosts)
    ? runtime.outboundHosts.filter((host): host is string => typeof host === 'string')
    : [];
};

export const createModuleAppCapabilityGateway = (params: {
  capability: ModuleAppCapabilityClaims;
  db: LobeChatDatabase;
}) => {
  const model = new ModuleAppModel(params.db);
  let gateKeeperPromise: ReturnType<typeof KeyVaultsGateKeeper.initWithEnvKey> | undefined;

  return new ModuleAppCapabilityGateway({
    context: {
      resolve: async (capability) => {
        const installation = await model.getRuntimeInstallationContext({
          appId: capability.appId,
          installationId: capability.installationId,
          userId: capability.userId,
          versionId: capability.versionId,
          workspaceId: capability.workspaceId,
        });
        if (!installation) throw new Error('MODULE_APP_CAPABILITY_SCOPE_MISMATCH');

        if (installation.scopeType === 'workspace') {
          if (!installation.workspaceId) throw new Error('MODULE_APP_CAPABILITY_SCOPE_MISMATCH');
          const member = await new WorkspaceMemberModel(
            params.db,
            capability.userId,
          ).getMember(installation.workspaceId, capability.userId);
          if (!member) throw new Error('MODULE_APP_CAPABILITY_SCOPE_MISMATCH');
        }

        return {
          appId: installation.appId,
          displayName: installation.displayName,
          installationId: installation.installationId,
          outboundHosts: resolveOutboundHosts(installation.runtimeManifest),
          scopeType: installation.scopeType,
          userId: installation.userId,
          versionId: installation.versionId,
          workspaceId: installation.workspaceId,
        };
      },
    },
    data: new ModuleAppDataService({ repository: new ModuleAppDataModel(params.db) }),
    files: new ModuleAppFileGateway({ storage: new FileS3() }),
    http: new ModuleAppHttpGateway(),
    notifications: new ModuleAppNotificationGateway({
      create: (input) => new NotificationModel(params.db, params.capability.userId).create(input),
      rateLimiter: notificationRateLimiter,
    }),
    replayGuard,
    secrets: new ModuleAppSecretsGateway({
      decrypt: async (encryptedValue) => {
        gateKeeperPromise ??= KeyVaultsGateKeeper.initWithEnvKey();
        return (await gateKeeperPromise).decrypt(encryptedValue);
      },
      getEncryptedValue: ({ installationId, key }) =>
        model.getInstallationSecret({ installationId, key }),
    }),
    tasks: new ModuleAppTaskService(new ModuleAppWorkflowModel(params.db)),
  });
};
