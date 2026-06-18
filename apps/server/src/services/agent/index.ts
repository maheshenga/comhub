import { type BuiltinAgentSlug } from '@lobechat/builtin-agents';
import { BUILTIN_AGENTS } from '@lobechat/builtin-agents';
import { DEFAULT_AGENT_CONFIG, INBOX_SESSION_ID } from '@lobechat/const';
import { type LobeChatDatabase } from '@lobechat/database';
import { type AgentItem, type LobeAgentConfig } from '@lobechat/types';
import { cleanObject, merge } from '@lobechat/utils';
import debug from 'debug';
import { type PartialDeep } from 'type-fest';

import { AgentModel } from '@/database/models/agent';
import { SessionModel } from '@/database/models/session';
import { UserModel } from '@/database/models/user';
import { getRedisConfig } from '@/envs/redis';
import {
  getJSONFromRedis,
  initializeRedisWithPrefix,
  isRedisEnabled,
  RedisKeyNamespace,
  RedisKeys,
} from '@/libs/redis';
import { getServerDefaultAgentConfig } from '@/server/globalConfig';
import { getServerDefaultAgentSettingOverrides } from '@/server/services/appSettings';

import { type UpdateAgentResult } from './type';

const log = debug('lobe-agent:service');

/**
 * Agent config with required id field.
 * Used when returning agent config from database (id is always present).
 */
export type AgentConfigWithId = LobeAgentConfig & { id: string; slug?: string | null };

interface AgentWelcomeData {
  openQuestions: string[];
  welcomeMessage: string;
}

const hasRuntimeModelSelection = (agent: any) => !!agent?.model || !!agent?.provider;

const hasBeenUpdatedAfterCreate = (agent: any) => {
  const createdAt = agent?.createdAt ? new Date(agent.createdAt).getTime() : Number.NaN;
  const updatedAt = agent?.updatedAt ? new Date(agent.updatedAt).getTime() : Number.NaN;

  return Number.isFinite(createdAt) && Number.isFinite(updatedAt) && updatedAt > createdAt;
};

const omitRuntimeModelOverride = (config: PartialDeep<LobeAgentConfig>) => {
  const { model: _model, provider: _provider, ...rest } = config;
  return rest;
};

/**
 * Agent Service
 *
 * Encapsulates "mutation + query" logic for agent operations.
 * After performing update operations, returns the updated agent data.
 */
export class AgentService {
  private readonly userId: string;
  private readonly db: LobeChatDatabase;
  private readonly agentModel: AgentModel;
  private readonly userModel: UserModel;
  private readonly workspaceId?: string;

  constructor(db: LobeChatDatabase, userId: string, workspaceId?: string) {
    this.userId = userId;
    this.db = db;
    this.workspaceId = workspaceId;
    this.agentModel = new AgentModel(db, userId, workspaceId);
    this.userModel = new UserModel(db, userId);
  }

  async createInbox() {
    const sessionModel = new SessionModel(this.db, this.userId, this.workspaceId);
    const defaultAgentConfig = merge(
      getServerDefaultAgentConfig(),
      await getServerDefaultAgentSettingOverrides(this.db),
    );
    await sessionModel.createInbox(defaultAgentConfig);
  }

  /**
   * Get a builtin agent by slug, creating it if it doesn't exist.
   * This is a generic interface for all builtin agents (page-copilot, inbox, etc.)
   *
   * The returned agent config is merged with:
   * 1. DEFAULT_AGENT_CONFIG (hardcoded defaults)
   * 2. Server's globalDefaultAgentConfig (from environment variable DEFAULT_AGENT_CONFIG)
   * 3. The actual agent config from database
   * 4. Avatar from builtin-agents package definition (if available)
   *
   * This ensures the frontend always receives a complete config with model/provider.
   */
  async getBuiltinAgent(slug: string) {
    // Fetch agent and defaultAgentConfig in parallel
    const [agent, defaultAgentConfig] = await Promise.all([
      this.agentModel.getBuiltinAgent(slug),
      this.userModel.getUserSettingsDefaultAgentConfig(),
    ]);

    const mergedConfig = await this.mergeDefaultConfig(agent, defaultAgentConfig);
    if (!mergedConfig) return null;

    // Use builtin avatar as fallback only when DB has no custom avatar
    const builtinAgent = BUILTIN_AGENTS[slug as BuiltinAgentSlug];
    if (builtinAgent?.avatar && !mergedConfig.avatar) {
      return { ...mergedConfig, avatar: builtinAgent.avatar };
    }

    return mergedConfig;
  }

  /**
   * Get agent config by ID or slug with default config merged.
   * Supports both agentId and slug lookup.
   *
   * The returned agent config is merged with:
   * 1. DEFAULT_AGENT_CONFIG (hardcoded defaults)
   * 2. Server's globalDefaultAgentConfig (from environment variable DEFAULT_AGENT_CONFIG)
   * 3. User's defaultAgentConfig (from user settings)
   * 4. The actual agent config from database
   */
  async getAgentConfig(idOrSlug: string): Promise<AgentConfigWithId | null> {
    const [agent, defaultAgentConfig] = await Promise.all([
      this.agentModel.getAgentConfig(idOrSlug),
      this.userModel.getUserSettingsDefaultAgentConfig(),
    ]);

    return (await this.mergeDefaultConfig(agent, defaultAgentConfig)) as AgentConfigWithId | null;
  }

  /**
   * Get agent config by ID with default config merged.
   *
   * The returned agent config is merged with:
   * 1. DEFAULT_AGENT_CONFIG (hardcoded defaults)
   * 2. Server's globalDefaultAgentConfig (from environment variable DEFAULT_AGENT_CONFIG)
   * 3. User's defaultAgentConfig (from user settings)
   * 4. The actual agent config from database
   * 5. AI-generated welcome data from Redis (if available)
   */
  async getAgentConfigById(agentId: string) {
    const [agent, defaultAgentConfig, welcomeData] = await Promise.all([
      this.agentModel.getAgentConfigById(agentId),
      this.userModel.getUserSettingsDefaultAgentConfig(),
      this.getAgentWelcomeFromRedis(agentId),
    ]);

    const config = await this.mergeDefaultConfig(agent, defaultAgentConfig);
    if (!config) return null;

    // Merge AI-generated welcome data if available
    if (welcomeData) {
      return {
        ...config,
        openingMessage: welcomeData.welcomeMessage,
        openingQuestions: welcomeData.openQuestions,
      };
    }

    return config;
  }

  /**
   * Get AI-generated welcome data from Redis
   * Returns null if Redis is disabled or data doesn't exist
   */
  private async getAgentWelcomeFromRedis(agentId: string): Promise<AgentWelcomeData | null> {
    try {
      const redisConfig = getRedisConfig();
      if (!isRedisEnabled(redisConfig)) return null;

      const redis = await initializeRedisWithPrefix(redisConfig, RedisKeyNamespace.AI_GENERATION);
      return getJSONFromRedis<AgentWelcomeData>(
        redis,
        RedisKeys.aiGeneration.agentWelcome(agentId),
      );
    } catch (error) {
      // Log error for observability but don't break agent retrieval
      log('Failed to get agent welcome from Redis for agent %s: %O', agentId, error);
      return null;
    }
  }

  /**
   * Merge default config with agent config.
   * Returns null if agent is null/undefined.
   *
   * Merge order (later values override earlier):
   * 1. DEFAULT_AGENT_CONFIG - hardcoded defaults
   * 2. serverDefaultAgentConfig - from environment variable
   * 3. adminDefaultAgentConfig - from backend app settings
   * 4. userDefaultAgentConfig - from user settings (defaultAgent.config)
   * 5. agent - actual agent config from database
   *
   * Inbox applies adminDefaultAgentConfig again at the end so global assistant
   * name/avatar settings cannot be shadowed by stale persisted inbox rows.
   * ComHub keeps a user-updated inbox model/provider intact; otherwise the
   * model selector saves to DB but the next hydrate resets chat sends to the
   * backend default model.
   *
   * Workspace exception: a workspace is a shared resource, so its agents must
   * NOT inherit any individual member's *personal* default model. Otherwise a
   * shared agent persisted with an empty model (e.g. the workspace inbox)
   * resolves to whoever opens it — the creator's personal default leaks in and
   * the workspace looks "initialized" with their model. For workspace-scoped
   * reads we skip only the personal user layer while keeping ComHub's admin
   * default layer.
   */
  private async mergeDefaultConfig(
    agent: any,
    defaultAgentConfig: Awaited<ReturnType<UserModel['getUserSettingsDefaultAgentConfig']>>,
  ): Promise<LobeAgentConfig | null> {
    if (!agent) return null;

    // Merge configs in order: DEFAULT -> server -> [user] -> agent
    const serverDefaultAgentConfig = getServerDefaultAgentConfig();
    const adminDefaultAgentConfig = await getServerDefaultAgentSettingOverrides(this.db);
    const baseConfig = merge(DEFAULT_AGENT_CONFIG, serverDefaultAgentConfig);
    const withAdminConfig = merge(baseConfig, adminDefaultAgentConfig);
    const userDefaultAgentConfig =
      (defaultAgentConfig as { config?: PartialDeep<LobeAgentConfig> })?.config || {};

    // Skip the personal default layer for workspace-scoped agents (see above).
    const configBeforeAgent = this.workspaceId
      ? withAdminConfig
      : merge(withAdminConfig, userDefaultAgentConfig);
    const mergedConfig = merge(configBeforeAgent, cleanObject(agent));

    if (agent.slug !== INBOX_SESSION_ID) return mergedConfig;

    const shouldPreserveInboxRuntimeSelection =
      hasRuntimeModelSelection(agent) && hasBeenUpdatedAfterCreate(agent);
    const inboxAdminConfig = shouldPreserveInboxRuntimeSelection
      ? omitRuntimeModelOverride(adminDefaultAgentConfig)
      : adminDefaultAgentConfig;

    return merge(mergedConfig, inboxAdminConfig);
  }

  /**
   * Update agent config and return the updated data
   * Pattern: update + query
   *
   * This method combines config update and querying into a single operation,
   * reducing the need for separate refresh calls and improving performance.
   */
  async updateAgentConfig(
    agentId: string,
    value: PartialDeep<AgentItem>,
  ): Promise<UpdateAgentResult> {
    // 1. Execute update
    await this.agentModel.updateConfig(agentId, value);

    // 2. Query and return updated data (with default config merged)
    const agent = await this.getAgentConfigById(agentId);

    return { agent: agent as any, success: true };
  }
}
