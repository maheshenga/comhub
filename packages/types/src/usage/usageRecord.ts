import type { MessageMetadata } from '../message';

export interface UsageRecordItem {
  createdAt: Date;
  /**
   * ID
   **/
  id: string;
  inputStartAt?: Date | null;
  /**
   * Meta information
   **/
  metadata?: MessageMetadata | null;
  /**
   * Model id
   */
  model: string;
  outputFinishAt?: Date | null;
  outputStartAt?: Date | null;
  /**
   * Provider id
   */
  provider: string;
  /**
   * Spend
   **/
  spend: number;
  /**
   * Usage details
   **/
  totalInputTokens?: number | null;
  totalOutputTokens?: number | null;
  totalTokens?: number | null;
  /**
   * Performance details
   **/
  tps?: number | null;
  ttft?: number | null;
  /**
   * Call types
   **/
  type: string;
  updatedAt: Date;
  userId: string;
}

export type UsageLog = {
  date: number;
  day: string;
  records: UsageRecordItem[];
  totalRequests: number;
  totalSpend: number;
  totalTokens: number;
};

export type AgentUsageGranularity = 'day' | 'week';

export interface AgentUsageBucket {
  cacheWriteCost: number;
  cacheWriteTokens: number;
  date: number;
  inputCost: number;
  inputTokens: number;
  label: string;
  outputCost: number;
  outputTokens: number;
  totalCost: number;
}

export interface AgentUsageModelRow {
  cost: number;
  id: string;
  model: string;
  provider: string;
  requests: number;
  totalTokens: number;
}

export interface AgentUsageStats {
  buckets: AgentUsageBucket[];
  byModel: AgentUsageModelRow[];
  summary: {
    cacheHitRate: number;
    cacheReadTokens: number;
    cacheSavings: number;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    totalRequests: number;
    totalTokens: number;
  };
}
