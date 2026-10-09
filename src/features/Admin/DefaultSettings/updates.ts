import { APP_SETTING_KEYS } from '@/const/appSettingsRegistry';
import { buildRuntimeSettingUpdates } from '@/features/Admin/adminRuntimeModelSettings';
import type { buildModelOptions} from '@/features/Admin/adminSettingsForm';
import { resolveModelOptionValue } from '@/features/Admin/adminSettingsForm';
import { normalizeConfiguredInterestAreas } from '@/features/ProfileInterests/interestAreas';

import type { DefaultSettingsData, FormValues, SettingUpdate } from './shared';
import { applyModelValue, jsonStringify, parseJsonObject, parseModelValue, splitTextList } from './shared';

export const buildUserDefaultsUpdates = (values: FormValues): SettingUpdate[] => {
  const userGlobalSettings = parseJsonObject(values.userGlobalSettingsJson);
  const systemAgent =
    userGlobalSettings.systemAgent &&
    typeof userGlobalSettings.systemAgent === 'object' &&
    !Array.isArray(userGlobalSettings.systemAgent)
      ? { ...userGlobalSettings.systemAgent }
      : {};

  applyModelValue(systemAgent, 'topic', values.serviceModelTopic);
  applyModelValue(systemAgent, 'generationTopic', values.serviceModelGenerationTopic);
  applyModelValue(systemAgent, 'translation', values.serviceModelTranslation);
  applyModelValue(systemAgent, 'historyCompress', values.serviceModelHistoryCompress);
  applyModelValue(systemAgent, 'agentMeta', values.serviceModelAgentMeta);
  applyModelValue(systemAgent, 'thread', values.serviceModelThread);
  applyModelValue(systemAgent, 'followUpAction', values.serviceModelFollowUpAction);
  applyModelValue(systemAgent, 'inputCompletion', values.serviceModelInputCompletion);
  applyModelValue(systemAgent, 'promptRewrite', values.serviceModelPromptRewrite);

  systemAgent.followUpAction = {
    ...systemAgent.followUpAction,
    enabled: values.serviceModelFollowUpActionEnabled,
  };
  systemAgent.inputCompletion = {
    ...systemAgent.inputCompletion,
    enabled: values.serviceModelInputCompletionEnabled,
  };
  systemAgent.promptRewrite = {
    ...systemAgent.promptRewrite,
    enabled: values.serviceModelPromptRewriteEnabled,
  };

  const defaultAgent =
    userGlobalSettings.defaultAgent &&
    typeof userGlobalSettings.defaultAgent === 'object' &&
    !Array.isArray(userGlobalSettings.defaultAgent)
      ? { ...userGlobalSettings.defaultAgent }
      : {};
  const defaultAgentConfig =
    defaultAgent.config &&
    typeof defaultAgent.config === 'object' &&
    !Array.isArray(defaultAgent.config)
      ? { ...defaultAgent.config }
      : {};
  delete defaultAgentConfig.model;
  delete defaultAgentConfig.provider;
  const defaultAgentModel = parseModelValue(values.serviceModelDefaultAgent);
  if (defaultAgentModel) Object.assign(defaultAgentConfig, defaultAgentModel);

  const shouldWriteDefaultAgent =
    Boolean(defaultAgentModel) ||
    Object.keys(defaultAgent).length > 0 ||
    Object.keys(defaultAgentConfig).length > 0;
  const mergedUserGlobalSettings = {
    ...userGlobalSettings,
    ...(shouldWriteDefaultAgent
      ? { defaultAgent: { ...defaultAgent, config: defaultAgentConfig } }
      : {}),
    languageModel: parseJsonObject(values.languageModelDefaultsJson),
    systemAgent,
    tool: {
      ...userGlobalSettings.tool,
      uninstalledBuiltinTools: splitTextList(values.disabledBuiltinToolsText),
    },
  };

  return [
    { key: APP_SETTING_KEYS.userGlobalSettingsDefaults, value: mergedUserGlobalSettings },
    { key: APP_SETTING_KEYS.profileAvatarPresets, value: values.avatarPresets ?? [] },
    {
      key: APP_SETTING_KEYS.profileInterestAreas,
      value: normalizeConfiguredInterestAreas(values.profileInterestAreas),
    },
  ];
};

export const buildIntegrationUpdates = (values: FormValues): SettingUpdate[] => [
  { key: APP_SETTING_KEYS.composioEnabled, value: values.composioEnabled ?? false },
  { key: APP_SETTING_KEYS.composioAuthConfigIds, value: values.composioAuthConfigIds ?? '' },
  ...(values.composioClearApiKey || values.composioApiKey?.trim()
    ? [
        {
          key: APP_SETTING_KEYS.composioApiKey,
          value: values.composioClearApiKey ? '' : values.composioApiKey?.trim(),
        },
      ]
    : []),
];

export const buildRuntimeUpdates = (
  values: FormValues,
  options: {
    chatOptions: ReturnType<typeof buildModelOptions>;
    embeddingOptions: ReturnType<typeof buildModelOptions>;
    rerankerOptions: ReturnType<typeof buildModelOptions>;
  },
): SettingUpdate[] =>
  buildRuntimeSettingUpdates({
    chatOptions: options.chatOptions,
    embeddingOptions: options.embeddingOptions,
    rerankerOptions: options.rerankerOptions,
    values,
  });

export const applyUserDefaultsToForm = (
  settings: DefaultSettingsData,
  modelOptions: ReturnType<typeof buildModelOptions>,
): Partial<FormValues> => {
  const userDefaults = settings.userGlobalSettingsDefaults ?? {};
  const systemAgent = userDefaults.systemAgent ?? {};

  return {
    avatarPresets: settings.avatarPresets ?? [],
    disabledBuiltinToolsText: Array.isArray(userDefaults.tool?.uninstalledBuiltinTools)
      ? userDefaults.tool.uninstalledBuiltinTools.join('\n')
      : '',
    languageModelDefaultsJson: jsonStringify(userDefaults.languageModel ?? {}),
    profileInterestAreas: normalizeConfiguredInterestAreas(settings.profileInterestAreas),
    serviceModelAgentMeta: resolveModelOptionValue(systemAgent.agentMeta, modelOptions),
    serviceModelDefaultAgent: resolveModelOptionValue(
      userDefaults.defaultAgent?.config,
      modelOptions,
    ),
    serviceModelFollowUpAction: resolveModelOptionValue(systemAgent.followUpAction, modelOptions),
    serviceModelFollowUpActionEnabled: systemAgent.followUpAction?.enabled ?? false,
    serviceModelGenerationTopic: resolveModelOptionValue(systemAgent.generationTopic, modelOptions),
    serviceModelHistoryCompress: resolveModelOptionValue(systemAgent.historyCompress, modelOptions),
    serviceModelInputCompletion: resolveModelOptionValue(systemAgent.inputCompletion, modelOptions),
    serviceModelInputCompletionEnabled: systemAgent.inputCompletion?.enabled ?? false,
    serviceModelPromptRewrite: resolveModelOptionValue(systemAgent.promptRewrite, modelOptions),
    serviceModelPromptRewriteEnabled: systemAgent.promptRewrite?.enabled ?? true,
    serviceModelThread: resolveModelOptionValue(systemAgent.thread, modelOptions),
    serviceModelTopic: resolveModelOptionValue(systemAgent.topic, modelOptions),
    serviceModelTranslation: resolveModelOptionValue(systemAgent.translation, modelOptions),
    userGlobalSettingsJson: jsonStringify(userDefaults),
  };
};

export const applyRuntimeToForm = (settings: DefaultSettingsData): Partial<FormValues> => {
  const memory = settings.memoryExtractionConfig ?? {};
  const vector = settings.vectorConfig ?? {};

  return {
    memoryEmbeddingModel: memory.embeddingModel ?? '',
    memoryEmbeddingProvider: memory.embeddingProvider ?? '',
    memoryGatekeeperModel: memory.gatekeeperModel ?? '',
    memoryGatekeeperProvider: memory.gatekeeperProvider ?? '',
    memoryLayerExtractorModel: memory.layerExtractorModel ?? '',
    memoryLayerExtractorProvider: memory.layerExtractorProvider ?? '',
    memoryPersonaWriterModel: memory.personaWriterModel ?? '',
    memoryPersonaWriterProvider: memory.personaWriterProvider ?? '',
    vectorEmbeddingModel: vector.embeddingModel ?? '',
    vectorEmbeddingProvider: vector.embeddingProvider ?? '',
    vectorQueryMode: vector.queryMode ?? '',
    vectorRerankerModel: vector.rerankerModel ?? '',
    vectorRerankerProvider: vector.rerankerProvider ?? '',
  };
};

export const applyIntegrationsToForm = (settings: DefaultSettingsData): Partial<FormValues> => {
  const composio = settings.composioConfig ?? {};

  return {
    composioApiKey: '',
    composioAuthConfigIds: composio.authConfigIds ?? '',
    composioClearApiKey: false,
    composioEnabled: composio.enabled ?? false,
  };
};
