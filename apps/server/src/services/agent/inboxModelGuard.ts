import { INBOX_SESSION_ID } from '@lobechat/const';
import { type LobeAgentConfig } from '@lobechat/types';
import { type PartialDeep } from 'type-fest';

/**
 * ComHub inbox model-override guard.
 *
 * ComHub keeps a user-updated inbox model/provider intact: when an inbox row
 * has a runtime model selection AND has been written after its creation, the
 * global admin default is re-applied at the end of the merge *without* its
 * model/provider fields, so the model selector's DB write survives the next
 * hydrate. Without the guard the selector saves to DB but chat sends silently
 * reset to the backend default model.
 *
 * Owned here so apps/server/src/services/agent/index.ts (upstream file) only
 * threads the guard into its mergeDefaultConfig.
 */

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
 * Final merge layer for inbox rows: the admin default config, minus its
 * runtime model fields when the inbox carries a user's own selection made
 * after creation. Returns undefined for non-inbox agents (no extra layer).
 */
export const resolveInboxAdminOverride = (
  agent: {
    createdAt?: Date | string | null;
    model?: string | null;
    provider?: string | null;
    slug?: string | null;
    updatedAt?: Date | string | null;
  } | null,
  adminDefaultAgentConfig: PartialDeep<LobeAgentConfig>,
): PartialDeep<LobeAgentConfig> | undefined => {
  if (!agent || agent.slug !== INBOX_SESSION_ID) return undefined;

  const shouldPreserveInboxRuntimeSelection =
    hasRuntimeModelSelection(agent) && hasBeenUpdatedAfterCreate(agent);

  return shouldPreserveInboxRuntimeSelection
    ? omitRuntimeModelOverride(adminDefaultAgentConfig)
    : adminDefaultAgentConfig;
};
