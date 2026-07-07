import type {
  PlatformPluginDetail,
  PlatformPluginListItem,
  PlatformPluginRunResult,
} from '@lobechat/types';

import { lambdaClient } from '@/libs/trpc/client';

type PlatformPluginClient = {
  platformPlugin: {
    getDetail: { query: (input: { pluginIdOrSlug: string }) => Promise<PlatformPluginDetail> };
    install: { mutate: (input: { pluginId: string }) => Promise<{ ok: true }> };
    listInstalled: { query: () => Promise<PlatformPluginListItem[]> };
    listMarketplace: { query: () => Promise<PlatformPluginListItem[]> };
    run: {
      mutate: (input: {
        actionId: string;
        agentId: string;
        input?: Record<string, unknown>;
        pluginId: string;
      }) => Promise<PlatformPluginRunResult>;
    };
    setAgentBinding: {
      mutate: (input: { agentId: string; enabled: boolean; pluginId: string }) => Promise<{ ok: true }>;
    };
    uninstall: { mutate: (input: { pluginId: string }) => Promise<{ ok: true }> };
  };
};

export const createPlatformPluginService = (client: PlatformPluginClient) => ({
  getDetail: (input: { pluginIdOrSlug: string }) => client.platformPlugin.getDetail.query(input),
  install: (input: { pluginId: string }) => client.platformPlugin.install.mutate(input),
  listInstalled: () => client.platformPlugin.listInstalled.query(),
  listMarketplace: () => client.platformPlugin.listMarketplace.query(),
  run: (input: {
    actionId: string;
    agentId: string;
    input?: Record<string, unknown>;
    pluginId: string;
  }) => client.platformPlugin.run.mutate(input),
  setAgentBinding: (input: { agentId: string; enabled: boolean; pluginId: string }) =>
    client.platformPlugin.setAgentBinding.mutate(input),
  uninstall: (input: { pluginId: string }) => client.platformPlugin.uninstall.mutate(input),
});

export const platformPluginService = createPlatformPluginService(
  lambdaClient as unknown as PlatformPluginClient,
);
