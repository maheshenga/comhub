import type { InstallMarketplaceAgentSummary } from '@lobechat/builtin-tool-agent-marketplace';

import { agentService } from '@/services/agent';
import { discoverService } from '@/services/discover';
import { useAgentStore } from '@/store/agent';
import { useHomeStore } from '@/store/home';

export type { InstallMarketplaceAgentSummary };

const getSourcePath = () => {
  if (typeof location === 'undefined') return 'onboarding/agent-marketplace';

  return location.pathname;
};

export interface InstallMarketplaceAgentsResult {
  installedAgentIds: string[];
  skippedAgentIds: string[];
  summaries: InstallMarketplaceAgentSummary[];
}

export const installMarketplaceAgents = async (
  sourceAgentIds: string[],
): Promise<InstallMarketplaceAgentsResult> => {
  const installedAgentIds: string[] = [];
  const skippedAgentIds: string[] = [];
  const summaries: InstallMarketplaceAgentSummary[] = [];
  const createAgent = useAgentStore.getState().createAgent;
  const refreshAgentList = useHomeStore.getState().refreshAgentList;

  for (const sourceAgentId of sourceAgentIds) {
    const existingAgentId = await agentService.getAgentByForkedFromIdentifier(sourceAgentId);
    if (existingAgentId) {
      skippedAgentIds.push(sourceAgentId);
      summaries.push({ skipped: true, templateId: sourceAgentId });
      continue;
    }

    const marketAgent = await discoverService.getAssistantDetail({
      identifier: sourceAgentId,
      source: 'new',
    });

    if (!marketAgent?.config) {
      throw new Error(`Marketplace agent config is missing: ${sourceAgentId}`);
    }

    const summaryBase: InstallMarketplaceAgentSummary = {
      category: marketAgent.category,
      description: marketAgent.description || marketAgent.summary,
      skipped: false,
      templateId: sourceAgentId,
      title: marketAgent.title,
    };

    const result = await createAgent({
      config: {
        ...marketAgent.config,
        avatar: marketAgent.avatar,
        backgroundColor: marketAgent.backgroundColor,
        description: marketAgent.description,
        editorData: marketAgent.editorData,
        marketIdentifier: sourceAgentId,
        params: {
          ...marketAgent.config.params,
          forkedFromIdentifier: sourceAgentId,
        },
        tags: marketAgent.tags,
        title: marketAgent.title,
      },
    });

    installedAgentIds.push(result.agentId);
    summaries.push({ ...summaryBase, installedAgentId: result.agentId });

    discoverService.reportAgentEvent({
      event: 'add',
      identifier: sourceAgentId,
      source: getSourcePath(),
    });
  }

  if (installedAgentIds.length > 0) {
    await refreshAgentList();
  }

  return { installedAgentIds, skippedAgentIds, summaries };
};
