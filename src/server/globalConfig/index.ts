import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import { merge } from '@lobechat/utils';
import { type AiFullModelCard } from 'model-bank';
import { gptImage1Schema, seedance15ProParams } from 'model-bank/lobehub';

import { klavisEnv } from '@/config/klavis';
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
  getServerDefaultAgentSettingOverrides,
  getServerDefaultGenerationModelSettingOverrides,
  getServerFileS3Config,
  getServerUserGlobalSettingsDefaults,
  getServerVectorSettingOverrides,
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

const ADMIN_MANAGED_AI_PROVIDER = 'newapi';

export const getServerGlobalConfig = async (db?: LobeChatDatabase) => {
  const defaultAgentConfig = await getResolvedServerDefaultAgentConfig(db);
  const defaultAgentMeta = cleanObject({
    avatar: defaultAgentConfig.avatar,
    title: defaultAgentConfig.title,
  });
  const generationModelConfig = await getServerDefaultGenerationModelSettingOverrides(db);
  const userDefaults = await getServerUserGlobalSettingsDefaults(db);
  const s3Config = await getServerFileS3Config(db);
  const aiProvider = await genServerAiProvidersConfig({
    ...(ENABLE_BUSINESS_FEATURES
      ? {
          [ADMIN_MANAGED_AI_PROVIDER]: {
            enabled: true,
          },
        }
      : {}),
    azure: {
      enabledKey: 'ENABLED_AZURE_OPENAI',
      withDeploymentName: true,
    },
    azureai: {
      withDeploymentName: true,
    },
    bedrock: {
      enabledKey: 'ENABLED_AWS_BEDROCK',
      modelListKey: 'AWS_BEDROCK_MODEL_LIST',
    },
    deepseek: ENABLE_BUSINESS_FEATURES ? {} : { enabled: true },
    giteeai: {
      enabledKey: 'ENABLED_GITEE_AI',
      modelListKey: 'GITEE_AI_MODEL_LIST',
    },
    kimicodingplan: {
      withDeploymentName: true,
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
    spark: {
      withDeploymentName: true,
    },
    tencentcloud: {
      enabledKey: 'ENABLED_TENCENT_CLOUD',
      modelListKey: 'TENCENT_CLOUD_MODEL_LIST',
    },
    volcengine: {
      withDeploymentName: true,
    },
    volcenginecodingplan: {
      withDeploymentName: true,
    },
  });

  if (ENABLE_BUSINESS_FEATURES) {
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

      aiProvider[ADMIN_MANAGED_AI_PROVIDER] = {
        ...aiProvider[ADMIN_MANAGED_AI_PROVIDER],
        enabledModels: managedNewApiModelIds,
        serverModelLists,
      };
    }
  }

  const config: GlobalServerConfig = {
    aiProvider,
    defaultAgent: {
      config: defaultAgentConfig,
      ...(Object.keys(defaultAgentMeta).length > 0 ? { meta: defaultAgentMeta } : {}),
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
    enableUploadFileToServer: !!(
      s3Config.accessKeyId &&
      s3Config.secretAccessKey &&
      s3Config.endpoint &&
      s3Config.bucket
    ),
    enableVisualUnderstanding: !!(
      toolsEnv.VISUAL_UNDERSTANDING_PROVIDER && toolsEnv.VISUAL_UNDERSTANDING_MODEL
    ),
    ...(toolsEnv.VISUAL_UNDERSTANDING_PROVIDER && toolsEnv.VISUAL_UNDERSTANDING_MODEL
      ? {
          visualUnderstanding: {
            model: toolsEnv.VISUAL_UNDERSTANDING_MODEL,
            provider: toolsEnv.VISUAL_UNDERSTANDING_PROVIDER,
          },
        }
      : undefined),

    // Expose Agent Gateway URL to client (used by hetero agents; also required for queue mode)
    ...(appEnv.AGENT_GATEWAY_URL ? { agentGatewayUrl: appEnv.AGENT_GATEWAY_URL } : undefined),

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
    userDefaults,
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
