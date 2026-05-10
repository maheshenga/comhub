import { BRANDING_PROVIDER, ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import { merge } from '@lobechat/utils';
import { type AiFullModelCard } from 'model-bank';
import { gptImage1Schema, seedance15ProParams } from 'model-bank/lobehub';

import { klavisEnv } from '@/config/klavis';
import { isDesktop } from '@/const/version';
import { type LobeChatDatabase } from '@/database/type';
import { appEnv, getAppConfig } from '@/envs/app';
import { authEnv } from '@/envs/auth';
import { fileEnv } from '@/envs/file';
import { imageEnv } from '@/envs/image';
import { knowledgeEnv } from '@/envs/knowledge';
import { langfuseEnv } from '@/envs/langfuse';
import { parseSSOProviders } from '@/libs/better-auth/utils/server';
import { parseSystemAgent } from '@/server/globalConfig/parseSystemAgent';
import {
  getServerDefaultAgentSettingOverrides,
  getServerDefaultGenerationModelSettingOverrides,
} from '@/server/services/appSettings';
import { getAllEnabledModels } from '@/server/services/newapiInstance';
import { type GlobalServerConfig } from '@/types/serverConfig';
import { cleanObject } from '@/utils/object';

import { genServerAiProvidersConfig } from './genServerAiProviderConfig';
import { parseAgentConfig } from './parseDefaultAgent';
import { parseFilesConfig } from './parseFilesConfig';
import { getPublicMemoryExtractionConfig } from './parseMemoryExtractionConfig';

/**
 * Get Better-Auth SSO providers list
 * Parses AUTH_SSO_PROVIDERS and returns enabled providers
 */
const getBetterAuthSSOProviders = () => {
  return parseSSOProviders(authEnv.AUTH_SSO_PROVIDERS);
};

const getGenericNewapiParameters = (type: string) => {
  if (type === 'image') return gptImage1Schema;
  if (type === 'video') return seedance15ProParams;
  return undefined;
};

export const getServerGlobalConfig = async (db?: LobeChatDatabase) => {
  const defaultAgentConfig = await getResolvedServerDefaultAgentConfig(db);
  const generationModelConfig = await getServerDefaultGenerationModelSettingOverrides(db);
  const aiProvider = await genServerAiProvidersConfig({
    ...(ENABLE_BUSINESS_FEATURES
      ? {
          [BRANDING_PROVIDER]: {
            enabled: true,
          },
        }
      : {}),
    azure: {
      enabledKey: 'ENABLED_AZURE_OPENAI',
      withDeploymentName: true,
    },
    bedrock: {
      enabledKey: 'ENABLED_AWS_BEDROCK',
      modelListKey: 'AWS_BEDROCK_MODEL_LIST',
    },
    giteeai: {
      enabledKey: 'ENABLED_GITEE_AI',
      modelListKey: 'GITEE_AI_MODEL_LIST',
    },
    lmstudio: {
      fetchOnClient: isDesktop ? false : undefined,
    },
    ollama: {
      enabled: isDesktop ? true : undefined,
      fetchOnClient: isDesktop ? false : !process.env.OLLAMA_PROXY_URL,
    },
    ollamacloud: {
      enabledKey: 'ENABLED_OLLAMA_CLOUD',
    },
    qwen: {
      withDeploymentName: true,
    },
    tencentcloud: {
      enabledKey: 'ENABLED_TENCENT_CLOUD',
      modelListKey: 'TENCENT_CLOUD_MODEL_LIST',
    },
    volcengine: {
      withDeploymentName: true,
    },
  });

  if (ENABLE_BUSINESS_FEATURES && BRANDING_PROVIDER === 'newapi') {
    const instanceModels = await getAllEnabledModels(db);
    const managedNewApiModelIds = Array.from(new Set(instanceModels.map((m) => m.id)));

    if (managedNewApiModelIds.length > 0) {
      const serverModelLists: AiFullModelCard[] = instanceModels.map((m) => {
        const parameters = getGenericNewapiParameters(m.type);

        return {
          displayName: m.displayName || m.id,
          enabled: true,
          id: m.id,
          ...(parameters ? { parameters } : {}),
          type: m.type,
        };
      });

      aiProvider[BRANDING_PROVIDER] = {
        ...aiProvider[BRANDING_PROVIDER],
        enabledModels: managedNewApiModelIds,
        serverModelLists,
      };
    }
  }

  const config: GlobalServerConfig = {
    aiProvider,
    defaultAgent: {
      config: defaultAgentConfig,
    },
    disableEmailPassword: authEnv.AUTH_DISABLE_EMAIL_PASSWORD,
    enableBusinessFeatures: ENABLE_BUSINESS_FEATURES,
    enableEmailVerification: authEnv.AUTH_EMAIL_VERIFICATION,
    enableKlavis: !!klavisEnv.KLAVIS_API_KEY,
    enableLobehubSkill: !!(appEnv.MARKET_TRUSTED_CLIENT_SECRET && appEnv.MARKET_TRUSTED_CLIENT_ID),
    enableMagicLink: authEnv.AUTH_ENABLE_MAGIC_LINK,
    enableMarketTrustedClient: !!(
      appEnv.MARKET_TRUSTED_CLIENT_SECRET && appEnv.MARKET_TRUSTED_CLIENT_ID
    ),
    enableUploadFileToServer: !!fileEnv.S3_SECRET_ACCESS_KEY,

    // Expose Agent Gateway URL to client when queue-based agent runtime is enabled
    ...(appEnv.enableQueueAgentRuntime && appEnv.AGENT_GATEWAY_URL
      ? { agentGatewayUrl: appEnv.AGENT_GATEWAY_URL }
      : undefined),

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
      userMemory: cleanObject(getPublicMemoryExtractionConfig()),
    },
    oAuthSSOProviders: getBetterAuthSSOProviders(),
    systemAgent: parseSystemAgent(appEnv.SYSTEM_AGENT),
    telemetry: {
      langfuse: langfuseEnv.ENABLE_LANGFUSE,
    },
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
