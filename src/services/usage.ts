import { lambdaClient } from '@/libs/trpc/client';
import { type AgentUsageGranularity } from '@/types/usage/usageRecord';

class UsageService {
  findByMonth = async (mo?: string, agentId?: string) => {
    return lambdaClient.usage.findByMonth.query({ agentId, mo });
  };

  findAndGroupByDay = async (mo?: string, agentId?: string) => {
    return lambdaClient.usage.findAndGroupByDay.query({ agentId, mo });
  };

  getAgentUsageStats = async (params: {
    agentId: string;
    endAt: string;
    granularity: AgentUsageGranularity;
    startAt: string;
  }) => {
    return lambdaClient.usage.getAgentUsageStats.query(params);
  };
}

export const usageService = new UsageService();
