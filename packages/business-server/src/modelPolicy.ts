import { AgentRuntimeError } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';

import type { LobeChatDatabase } from '@/database/type';
import {
  getServerModelPolicyConfig,
  type ServerModelPolicyUsageType,
} from '@/server/services/appSettings';

type AssertModelPolicyAllowedParams = {
  db?: LobeChatDatabase;
  model?: string | null;
  provider?: string | null;
  usageType: ServerModelPolicyUsageType;
};

const normalizeToken = (value?: string | null) => value?.trim().toLowerCase() || '';

const escapeRegExp = (value: string) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wildcardMatch = (pattern: string, value: string) => {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return pattern === value;

  const regexp = new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`, 'i');

  return regexp.test(value);
};

const matchesPolicyEntry = ({
  entry,
  model,
  provider,
}: {
  entry: string;
  model: string;
  provider: string;
}) => {
  const normalizedEntry = normalizeToken(entry);
  if (!normalizedEntry) return false;

  const providerModel = provider ? `${provider}:${model}` : model;
  const slashProviderModel = provider ? `${provider}/${model}` : model;

  return (
    wildcardMatch(normalizedEntry, model) ||
    wildcardMatch(normalizedEntry, providerModel) ||
    wildcardMatch(normalizedEntry, slashProviderModel)
  );
};

const shouldApplyPolicy = (
  usageType: ServerModelPolicyUsageType,
  config: Awaited<ReturnType<typeof getServerModelPolicyConfig>>,
) => {
  if (!config.enabled) return false;
  if (usageType === 'embeddings') return config.applyToEmbeddings;
  if (usageType === 'generate_object') return config.applyToGenerateObject;

  return true;
};

const throwModelPolicyDenied = ({
  message,
  model,
  mode,
  provider,
  usageType,
}: {
  message: string;
  model?: string | null;
  mode: 'allowlist' | 'blocklist';
  provider?: string | null;
  usageType: ServerModelPolicyUsageType;
}) => {
  throw AgentRuntimeError.createError(ChatErrorType.Forbidden, {
    message,
    model,
    mode,
    provider,
    reason: 'MODEL_POLICY_DENIED',
    usageType,
  });
};

export const assertModelPolicyAllowed = async ({
  db,
  model,
  provider,
  usageType,
}: AssertModelPolicyAllowedParams) => {
  const config = await getServerModelPolicyConfig(db);
  if (!shouldApplyPolicy(usageType, config)) return;

  const normalizedModel = normalizeToken(model);
  const normalizedProvider = normalizeToken(provider);

  if (!normalizedModel) {
    throwModelPolicyDenied({
      message: config.deniedMessage,
      model,
      mode: config.mode,
      provider,
      usageType,
    });
  }

  const matchedAllowlist = config.allowlist.some((entry) =>
    matchesPolicyEntry({ entry, model: normalizedModel, provider: normalizedProvider }),
  );
  const matchedBlocklist = config.blocklist.some((entry) =>
    matchesPolicyEntry({ entry, model: normalizedModel, provider: normalizedProvider }),
  );

  if (config.mode === 'allowlist' && !matchedAllowlist) {
    throwModelPolicyDenied({
      message: config.deniedMessage,
      model,
      mode: config.mode,
      provider,
      usageType,
    });
  }

  if (config.mode === 'blocklist' && matchedBlocklist) {
    throwModelPolicyDenied({
      message: config.deniedMessage,
      model,
      mode: config.mode,
      provider,
      usageType,
    });
  }
};
