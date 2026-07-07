import type { PlatformPluginListItem } from '@lobechat/types';

export const PLATFORM_PLUGIN_MENTION_TYPE = 'platformPlugin' as const;

type PlatformPluginMentionMetadata = {
  pluginId: string;
  pluginSlug: string;
  timestamp: number;
  type: typeof PLATFORM_PLUGIN_MENTION_TYPE;
};

export type PlatformPluginMentionItem = {
  key: string;
  label: string;
  metadata: PlatformPluginMentionMetadata;
};

export const buildPlatformPluginMentionItems = (
  plugins: PlatformPluginListItem[],
): PlatformPluginMentionItem[] =>
  plugins
    .filter(
      (plugin) =>
        plugin.installed && plugin.planState.visible && plugin.planState.runnable && !!plugin.id,
    )
    .map((plugin) => ({
      key: `platform-plugin-${plugin.id}`,
      label: plugin.displayName || plugin.slug,
      metadata: {
        pluginId: plugin.id,
        pluginSlug: plugin.slug,
        timestamp: 0,
        type: PLATFORM_PLUGIN_MENTION_TYPE,
      },
    }));

export const buildPlatformPluginRunRoute = ({
  agentId,
  pluginIdOrSlug,
}: {
  agentId?: string;
  pluginIdOrSlug: string;
}) => {
  const route = `/plugins/${encodeURIComponent(pluginIdOrSlug)}`;
  const normalizedAgentId = agentId?.trim();

  return normalizedAgentId ? `${route}?agentId=${encodeURIComponent(normalizedAgentId)}` : route;
};
