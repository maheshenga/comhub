import type { ModuleAppCapabilityClaims } from '@lobechat/types';

import type { ModuleAppDataService } from '../data/service';
import {
  assertModuleAppContextScope,
  type ModuleAppContextResolver,
  serializeModuleAppContext,
} from './context';
import type { ModuleAppFileGateway } from './files';
import type { ModuleAppHttpGateway } from './http';
import type { ModuleAppNotificationGateway } from './notifications';
import type { ModuleAppSecretsGateway } from './secrets';

export type ModuleAppGatewayMethod =
  | 'context.get'
  | 'data.archive'
  | 'data.get'
  | 'data.insert'
  | 'data.list'
  | 'data.transaction'
  | 'data.update'
  | 'files.createDownload'
  | 'files.createUpload'
  | 'http.fetch'
  | 'notifications.create'
  | 'secrets.get';

const requiredPermission: Record<ModuleAppGatewayMethod, null | string> = {
  'context.get': null,
  'data.archive': 'data.write',
  'data.get': 'data.read',
  'data.insert': 'data.write',
  'data.list': 'data.read',
  'data.transaction': 'data.write',
  'data.update': 'data.write',
  'files.createDownload': 'files.read',
  'files.createUpload': 'files.write',
  'http.fetch': 'http.fetch',
  'notifications.create': 'notifications.write',
  'secrets.get': 'secrets.read',
};

const mutationMethods = new Set<ModuleAppGatewayMethod>([
  'data.archive',
  'data.insert',
  'data.transaction',
  'data.update',
  'files.createUpload',
  'http.fetch',
  'notifications.create',
]);

export class ModuleAppReplayGuard {
  private readonly consumed = new Map<string, number>();

  consume = (capability: ModuleAppCapabilityClaims, requestId?: string) => {
    if (!requestId || requestId.length < 1 || requestId.length > 160) {
      throw new Error('MODULE_APP_CAPABILITY_REQUEST_ID_REQUIRED');
    }

    const now = Math.floor(Date.now() / 1000);
    for (const [key, expiresAt] of this.consumed) {
      if (expiresAt <= now) this.consumed.delete(key);
    }

    const key = `${capability.installationId}:${capability.nonce}:${requestId}`;
    if (this.consumed.has(key)) throw new Error('MODULE_APP_CAPABILITY_REPLAYED');
    this.consumed.set(key, capability.exp);
  };
}

type GatewayOptions = {
  context: ModuleAppContextResolver;
  data: ModuleAppDataService;
  files: ModuleAppFileGateway;
  http: ModuleAppHttpGateway;
  notifications: ModuleAppNotificationGateway;
  replayGuard: ModuleAppReplayGuard;
  secrets: ModuleAppSecretsGateway;
};

export class ModuleAppCapabilityGateway {
  private readonly context: ModuleAppContextResolver;
  private readonly data: ModuleAppDataService;
  private readonly files: ModuleAppFileGateway;
  private readonly http: ModuleAppHttpGateway;
  private readonly notifications: ModuleAppNotificationGateway;
  private readonly replayGuard: ModuleAppReplayGuard;
  private readonly secrets: ModuleAppSecretsGateway;

  constructor(options: GatewayOptions) {
    this.context = options.context;
    this.data = options.data;
    this.files = options.files;
    this.http = options.http;
    this.notifications = options.notifications;
    this.replayGuard = options.replayGuard;
    this.secrets = options.secrets;
  }

  call = async (params: {
    capability: ModuleAppCapabilityClaims;
    input?: unknown;
    method: ModuleAppGatewayMethod;
    requestId?: string;
  }) => {
    const permission = requiredPermission[params.method];
    if (permission && !params.capability.permissions.includes(permission)) {
      throw new Error('MODULE_APP_CAPABILITY_DENIED');
    }

    const context = await this.context.resolve(params.capability);
    assertModuleAppContextScope(params.capability, context);
    if (mutationMethods.has(params.method)) {
      this.replayGuard.consume(params.capability, params.requestId);
    }

    switch (params.method) {
      case 'context.get': {
        return serializeModuleAppContext(context);
      }
      case 'data.archive': {
        return this.data.archive({ capability: params.capability, input: params.input });
      }
      case 'data.get': {
        return this.data.get({ capability: params.capability, input: params.input });
      }
      case 'data.insert': {
        return this.data.insert({ capability: params.capability, input: params.input });
      }
      case 'data.list': {
        return this.data.list({ capability: params.capability, input: params.input });
      }
      case 'data.transaction': {
        return this.data.transaction({ capability: params.capability, input: params.input });
      }
      case 'data.update': {
        return this.data.update({ capability: params.capability, input: params.input });
      }
      case 'files.createDownload': {
        return this.files.createDownload(params.capability, params.input);
      }
      case 'files.createUpload': {
        return this.files.createUpload(params.capability, params.input);
      }
      case 'http.fetch': {
        return this.http.request(params.capability, context, params.input);
      }
      case 'notifications.create': {
        return this.notifications.createNotification(
          params.capability,
          params.input,
          params.requestId!,
        );
      }
      case 'secrets.get': {
        return this.secrets.get(params.capability, params.input);
      }
    }
  };
}
