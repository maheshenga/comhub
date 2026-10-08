import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import { parseToolNameMaxLength } from '@lobechat/const/plugin';
import { merge } from '@lobechat/utils';

import { isDesktop } from '@/const/version';
import { type LobeChatDatabase } from '@/database/type';
import { appEnv, getAppConfig } from '@/envs/app';
import { authEnv } from '@/envs/auth';
import { imageEnv } from '@/envs/image';
import { knowledgeEnv } from '@/envs/knowledge';
import { langfuseEnv } from '@/envs/langfuse';
import { toolsEnv } from '@/envs/tools';
import { parseSSOProviders } from '@/libs/better-auth/utils/server';
import { parseSystemAgent } from '@/server/globalConfig/parseSystemAgent';
import {
  getServerComposioConfig,
  getServerDefaultAgentSettingOverrides,
  getServerDefaultGenerationModelSettingOverrides,
  getServerFileS3Config,
  getServerPublicCustomizationConfig,
  getServerUserGlobalSettingsDefaults,
  getServerVectorSettingOverrides,
} from '@/server/services/appSettings';
import { getAllEnabledModels } from '@/server/services/newapiInstance';
import { type GlobalServerConfig } from '@/types/serverConfig';
import { cleanObject } from '@/utils/object';

import { genServerAiProvidersConfig } from './genServerAiProviderConfig';
import { parseAgentConfig } from './parseDefaultAgent';
import { parseFilesConfig } from './parseFilesConfig';
import { getResolvedPublicMemoryExtractionConfig } from './parseMemoryExtractionConfig';
import {
  applyAdminManagedProviders,
  type AdminManagedProviderConfig,
} from './adminManagedProviders';
import { getProviderSpecificConfig } from './providerSpecificConfig';

/**
 * Get Better-Auth SSO providers list
 * Parses AUTH_SSO_PROVIDERS and returns enabled providers
 */
const getBetterAuthSSOProviders = () => {
  return parseSSOProviders(authEnv.AUTH_SSO_PROVIDERS);
};

/**
 * Which Agent Gateway wire protocol the client may dial.
 *
 * The multiplexed `/v2/ws` socket only exists on the gateway that ships with
 * business builds. A self-hosted deployment runs `lobehub/lobehub-gateway`,
 * which serves `GET /ws` and nothing else — a client that picks v2 there only
 * reaches a working socket after burning its dial budget on 404s, so the
 * default has to be the one that works everywhere. `AGENT_GATEWAY_PROTOCOL`
 * overrides both guesses, which is what an on-prem business deployment sitting
 * in front of a v1 gateway needs.
 */
const resolveAgentGatewayProtocol = (): 1 | 2 => {
  if (appEnv.AGENT_GATEWAY_PROTOCOL === 2) return 2;
  if (appEnv.AGENT_GATEWAY_PROTOCOL === 1) return 1;

  return ENABLE_BUSINESS_FEATURES ? 2 : 1;
};

export const getServerGlobalConfig = async (db?: LobeChatDatabase) => {
  const defaultAgentConfig = await getResolvedServerDefaultAgentConfig(db);
  const defaultAgentMeta = cleanObject({
    avatar: defaultAgentConfig.avatar,
    title: defaultAgentConfig.title,
  });
  const generationModelConfig = await getServerDefaultGenerationModelSettingOverrides(db);
  const userDefaults = await getServerUserGlobalSettingsDefaults(db);
  const composioConfig = await getServerComposioConfig(db);
  const s3Config = await getServerFileS3Config(db);
  const customization = await getServerPublicCustomizationConfig(db);
  const aiProvider = (await genServerAiProvidersConfig(
    getProviderSpecificConfig({
      enableBusinessFeatures: ENABLE_BUSINESS_FEATURES,
      isDesktop,
      ollamaProxyUrl: process.env.OLLAMA_PROXY_URL,
    }),
  )) as Record<string, AdminManagedProviderConfig>;

  if (ENABLE_BUSINESS_FEATURES) {
    applyAdminManagedProviders(aiProvider, await getAllEnabledModels(db));
  }

  const config: GlobalServerConfig = {
    aiProvider,
    customization,
    defaultAgent: {
      config: defaultAgentConfig,
      ...(Object.keys(defaultAgentMeta).length > 0 ? { meta: defaultAgentMeta } : {}),
    },
    disableEmailPassword: authEnv.AUTH_DISABLE_EMAIL_PASSWORD,
    enableBusinessFeatures: ENABLE_BUSINESS_FEATURES,
    enableEmailVerification: authEnv.AUTH_EMAIL_VERIFICATION,
    enableComposio: composioConfig.enabled && Boolean(composioConfig.apiKey),
    enableGatewayMode:
      ENABLE_BUSINESS_FEATURES || (!!appEnv.ENABLE_AGENT_GATEWAY && !!appEnv.AGENT_GATEWAY_URL),
    enableLobehubSkill: !!(appEnv.MARKET_TRUSTED_CLIENT_SECRET && appEnv.MARKET_TRUSTED_CLIENT_ID),
    enableMagicLink: authEnv.AUTH_ENABLE_MAGIC_LINK,
    enableMarketTrustedClient: !!(
      appEnv.MARKET_TRUSTED_CLIENT_SECRET && appEnv.MARKET_TRUSTED_CLIENT_ID
    ),
    enableUploadFileToServer: !!(
      s3Config.accessKeyId &&
      s3Config.secretAccessKey &&
      s3Config.endpoint &&
      s3Config.bucket
    ),
    enableMultimodalUnderstanding: !!(
      toolsEnv.MULTIMODAL_UNDERSTANDING_PROVIDER && toolsEnv.MULTIMODAL_UNDERSTANDING_MODEL
    ),
    ...(toolsEnv.MULTIMODAL_UNDERSTANDING_PROVIDER && toolsEnv.MULTIMODAL_UNDERSTANDING_MODEL
      ? {
          multimodalUnderstanding: {
            model: toolsEnv.MULTIMODAL_UNDERSTANDING_MODEL,
            provider: toolsEnv.MULTIMODAL_UNDERSTANDING_PROVIDER,
          },
        }
      : undefined),

    // Expose Agent Gateway URL to client (used by hetero agents; also required for queue mode)
    ...(appEnv.AGENT_GATEWAY_URL ? { agentGatewayUrl: appEnv.AGENT_GATEWAY_URL } : undefined),
    agentGatewayProtocol: resolveAgentGatewayProtocol(),

    image: cleanObject({
      defaultModel: generationModelConfig.image?.model,
      defaultImageNum: imageEnv.AI_IMAGE_DEFAULT_IMAGE_NUM,
      defaultProvider: generationModelConfig.image?.provider,
    }),
    video: cleanObject({
      defaultModel: generationModelConfig.video?.model,
      defaultProvider: generationModelConfig.video?.provider,
    }),
    memory: {
      userMemory: cleanObject(await getResolvedPublicMemoryExtractionConfig(db)),
    },
    oAuthSSOProviders: getBetterAuthSSOProviders(),
    systemAgent: parseSystemAgent(appEnv.SYSTEM_AGENT),
    telemetry: {
      langfuse: langfuseEnv.ENABLE_LANGFUSE,
    },
    userDefaults,
    // The client-driven chat path generates tool names in the browser, so the
    // server-only `TOOL_NAME_MAX_LENGTH` has to travel with the config for `0`
    // (compression off) to have any effect outside gateway mode. Parsed with the
    // resolver's own function so both sides read the raw value identically —
    // unset/invalid stays `undefined`, i.e. the resolver's default 64.
    toolNameMaxLength: parseToolNameMaxLength(toolsEnv.TOOL_NAME_MAX_LENGTH),
  };

  return config;
};

export const getServerDefaultAgentConfig = () => {
  const { DEFAULT_AGENT_CONFIG } = getAppConfig();

  return parseAgentConfig(DEFAULT_AGENT_CONFIG) || {};
};

export const getResolvedServerDefaultAgentConfig = async (db?: LobeChatDatabase) => {
  const envDefaultAgentConfig = getServerDefaultAgentConfig();
  const appSettingOverrides = await getServerDefaultAgentSettingOverrides(db);

  return merge(envDefaultAgentConfig, appSettingOverrides);
};

export const getServerDefaultFilesConfig = () => {
  return parseFilesConfig(knowledgeEnv.DEFAULT_FILES_CONFIG);
};

export const getResolvedServerDefaultFilesConfig = async (db?: LobeChatDatabase) => {
  const envFilesConfig = getServerDefaultFilesConfig();
  const overrides = await getServerVectorSettingOverrides(db);

  return merge(envFilesConfig, overrides);
};
