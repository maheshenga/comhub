'use client';

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Avatar, Flexbox } from '@lobehub/ui';
import {
  Alert,
  AutoComplete,
  Button,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';

import { Card } from '@/components/antd-compat/Card';
import {
  ADMIN_SETTINGS_SWR_KEY,
  PROFILE_INTEREST_AREAS_SWR_KEY,
  PROFILE_OPTIONS_SWR_KEY,
  RUNTIME_CONFIG_SWR_KEY,
  USER_STATE_SWR_KEY,
} from '@/const/adminCacheKeys';
import { type AvatarPreset, DEFAULT_AVATAR_PRESETS } from '@/const/avatarPresets';
import {
  buildModelOptions,
  type DefaultModelOption,
  resolveModelOptionValue,
  resolveModelProviderLabel,
} from '@/features/Admin/adminSettingsForm';
import ImageUrlUploadInput from '@/features/Admin/components/ImageUrlUploadInput';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text, Title } = Typography;

const SETTING_KEYS = {
  avatarPresets: 'profile.avatarPresets',
  composioApiKey: 'composio.apiKey',
  composioAuthConfigIds: 'composio.authConfigIds',
  composioEnabled: 'composio.enabled',
  memoryUserMemoryEmbeddingModel: 'memory.userMemory.embedding.model',
  memoryUserMemoryEmbeddingProvider: 'memory.userMemory.embedding.provider',
  memoryUserMemoryGatekeeperModel: 'memory.userMemory.gatekeeper.model',
  memoryUserMemoryGatekeeperProvider: 'memory.userMemory.gatekeeper.provider',
  memoryUserMemoryLayerExtractorModel: 'memory.userMemory.layerExtractor.model',
  memoryUserMemoryLayerExtractorProvider: 'memory.userMemory.layerExtractor.provider',
  memoryUserMemoryPersonaWriterModel: 'memory.userMemory.personaWriter.model',
  memoryUserMemoryPersonaWriterProvider: 'memory.userMemory.personaWriter.provider',
  userGlobalSettingsDefaults: 'user.globalSettings.defaults',
  vectorEmbeddingModel: 'vector.embedding.model',
  vectorEmbeddingProvider: 'vector.embedding.provider',
  vectorQueryMode: 'vector.queryMode',
  vectorRerankerModel: 'vector.reranker.model',
  vectorRerankerProvider: 'vector.reranker.provider',
} as const;

type FormValues = {
  avatarPresets: AvatarPreset[];
  composioApiKey?: string;
  composioAuthConfigIds?: string;
  composioClearApiKey?: boolean;
  composioEnabled?: boolean;
  disabledBuiltinToolsText: string;
  languageModelDefaultsJson: string;
  memoryEmbeddingModel: string;
  memoryEmbeddingProvider: string;
  memoryGatekeeperModel: string;
  memoryGatekeeperProvider: string;
  memoryLayerExtractorModel: string;
  memoryLayerExtractorProvider: string;
  memoryPersonaWriterModel: string;
  memoryPersonaWriterProvider: string;
  serviceModelAgentMeta: string;
  serviceModelDefaultAgent: string;
  serviceModelFollowUpAction: string;
  serviceModelFollowUpActionEnabled: boolean;
  serviceModelGenerationTopic: string;
  serviceModelHistoryCompress: string;
  serviceModelInputCompletion: string;
  serviceModelInputCompletionEnabled: boolean;
  serviceModelPromptRewrite: string;
  serviceModelPromptRewriteEnabled: boolean;
  serviceModelThread: string;
  serviceModelTopic: string;
  serviceModelTranslation: string;
  userGlobalSettingsJson: string;
  vectorEmbeddingModel: string;
  vectorEmbeddingProvider: string;
  vectorQueryMode: string;
  vectorRerankerModel: string;
  vectorRerankerProvider: string;
};

const jsonStringify = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

const splitTextList = (value?: string) =>
  Array.from(
    new Set(
      (value ?? '')
        .split(/[\r\n,;，；]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const parseJsonObject = (value: string) => {
  const parsed = JSON.parse(value || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('USER_GLOBAL_SETTINGS_MUST_BE_OBJECT');
  }

  return parsed;
};

const parseModelValue = (value?: string) => {
  if (!value) return null;
  const [provider, ...modelParts] = value.split(':');
  const model = modelParts.join(':');

  return provider && model ? { model, provider } : null;
};

const buildProviderOptions = (options: DefaultModelOption[]) =>
  Array.from(
    options
      .reduce((result, option) => {
        if (!option.provider) return result;

        result.set(option.provider, {
          label: resolveModelProviderLabel(
            { model: option.model, provider: option.provider },
            options,
          ),
          value: option.provider,
        });
        return result;
      }, new Map<string, { label: string; value: string }>())
      .values(),
  );

const findModelOption = (
  options: DefaultModelOption[],
  value?: string,
) => options.find((option) => option.value === value || option.model === value);

const normalizeMemoryModelFields = (
  modelValue: string | undefined,
  providerValue: string | undefined,
  options: DefaultModelOption[],
) => {
  const model = typeof modelValue === 'string' ? modelValue.trim() : '';
  const provider = typeof providerValue === 'string' ? providerValue.trim() : '';
  const selected =
    options.find((option) => option.value === model) ??
    options.find((option) => option.model === model && (!provider || option.provider === provider));

  return {
    model: selected?.value === model ? selected.model : model,
    provider: provider || selected?.provider || '',
  };
};

const applyModelValue = (target: Record<string, any>, key: string, value?: string) => {
  const current =
    target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
      ? { ...target[key] }
      : {};
  delete current.model;
  delete current.provider;

  const modelConfig = parseModelValue(value);
  if (!modelConfig) {
    if (Object.keys(current).length > 0) {
      target[key] = current;
    } else {
      delete target[key];
    }
    return;
  }

  target[key] = {
    ...current,
    ...modelConfig,
  };
};

const AdminSystemDefaultsPage = memo(() => {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { data, isLoading } = useClientDataSWR(ADMIN_SETTINGS_SWR_KEY, () =>
    adminCommercialService.getAllSettings(),
  );
  const uploadPublicUrlPrefix =
    typeof (data as any)?.storageS3PublicDomain === 'string'
      ? (data as any).storageS3PublicDomain
      : undefined;
  const modelOptions = useMemo(() => buildModelOptions({ ...data, modelType: 'chat' }), [data]);
  const embeddingModelOptions = useMemo(
    () => buildModelOptions({ ...data, modelType: 'embedding' }),
    [data],
  );
  const modelProviderOptions = useMemo(() => buildProviderOptions(modelOptions), [modelOptions]);
  const embeddingProviderOptions = useMemo(
    () => buildProviderOptions(embeddingModelOptions),
    [embeddingModelOptions],
  );
  const applySelectedModelProvider = (
    modelField: keyof FormValues,
    providerField: keyof FormValues,
    options: DefaultModelOption[],
    selectedValue?: string,
  ) => {
    const selected = findModelOption(options, selectedValue ?? form.getFieldValue(modelField));
    if (!selected) return;

    form.setFieldsValue({
      [modelField]: selected.model,
      [providerField]: selected.provider,
    } as Partial<FormValues>);
  };

  useEffect(() => {
    if (!data) return;

    const memoryExtractionConfig = (data as any).memoryExtractionConfig ?? {};
    const vectorConfig = (data as any).vectorConfig ?? {};
    const composioConfig = (data as any).composioConfig ?? {};
    const userDefaults = (data as any).userGlobalSettingsDefaults ?? {};
    const systemAgent = userDefaults.systemAgent ?? {};
    form.setFieldsValue({
      avatarPresets: (data as any).avatarPresets ?? DEFAULT_AVATAR_PRESETS,
      composioApiKey: '',
      composioAuthConfigIds: composioConfig.authConfigIds ?? '',
      composioClearApiKey: false,
      composioEnabled: composioConfig.enabled ?? false,
      disabledBuiltinToolsText: Array.isArray(userDefaults?.tool?.uninstalledBuiltinTools)
        ? userDefaults.tool.uninstalledBuiltinTools.join('\n')
        : '',
      languageModelDefaultsJson: jsonStringify(userDefaults?.languageModel ?? {}),
      memoryEmbeddingModel: memoryExtractionConfig.embeddingModel ?? '',
      memoryEmbeddingProvider: memoryExtractionConfig.embeddingProvider ?? '',
      memoryGatekeeperModel: memoryExtractionConfig.gatekeeperModel ?? '',
      memoryGatekeeperProvider: memoryExtractionConfig.gatekeeperProvider ?? '',
      memoryLayerExtractorModel: memoryExtractionConfig.layerExtractorModel ?? '',
      memoryLayerExtractorProvider: memoryExtractionConfig.layerExtractorProvider ?? '',
      memoryPersonaWriterModel: memoryExtractionConfig.personaWriterModel ?? '',
      memoryPersonaWriterProvider: memoryExtractionConfig.personaWriterProvider ?? '',
      serviceModelAgentMeta: resolveModelOptionValue(systemAgent.agentMeta, modelOptions),
      serviceModelDefaultAgent: resolveModelOptionValue(
        userDefaults?.defaultAgent?.config,
        modelOptions,
      ),
      serviceModelFollowUpAction: resolveModelOptionValue(systemAgent.followUpAction, modelOptions),
      serviceModelFollowUpActionEnabled: systemAgent.followUpAction?.enabled ?? false,
      serviceModelGenerationTopic: resolveModelOptionValue(
        systemAgent.generationTopic,
        modelOptions,
      ),
      serviceModelHistoryCompress: resolveModelOptionValue(
        systemAgent.historyCompress,
        modelOptions,
      ),
      serviceModelInputCompletion: resolveModelOptionValue(
        systemAgent.inputCompletion,
        modelOptions,
      ),
      serviceModelInputCompletionEnabled: systemAgent.inputCompletion?.enabled ?? false,
      serviceModelPromptRewrite: resolveModelOptionValue(systemAgent.promptRewrite, modelOptions),
      serviceModelPromptRewriteEnabled: systemAgent.promptRewrite?.enabled ?? true,
      serviceModelThread: resolveModelOptionValue(systemAgent.thread, modelOptions),
      serviceModelTopic: resolveModelOptionValue(systemAgent.topic, modelOptions),
      serviceModelTranslation: resolveModelOptionValue(systemAgent.translation, modelOptions),
      userGlobalSettingsJson: jsonStringify(userDefaults),
      vectorEmbeddingModel: vectorConfig.embeddingModel ?? '',
      vectorEmbeddingProvider: vectorConfig.embeddingProvider ?? '',
      vectorQueryMode: vectorConfig.queryMode ?? '',
      vectorRerankerModel: vectorConfig.rerankerModel ?? '',
      vectorRerankerProvider: vectorConfig.rerankerProvider ?? '',
    });
  }, [data, form, modelOptions]);

  const handleSave = async ({ syncToUsers = false }: { syncToUsers?: boolean } = {}) => {
    setSubmitting(true);
    if (syncToUsers) setSyncing(true);
    try {
      const values = await form.validateFields();
      const userGlobalSettings = parseJsonObject(values.userGlobalSettingsJson);
      const languageModelDefaults = parseJsonObject(values.languageModelDefaultsJson);
      const disabledBuiltinTools = splitTextList(values.disabledBuiltinToolsText);
      const defaultAgentModel = parseModelValue(values.serviceModelDefaultAgent);
      const memoryGatekeeper = normalizeMemoryModelFields(
        values.memoryGatekeeperModel,
        values.memoryGatekeeperProvider,
        modelOptions,
      );
      const memoryLayerExtractor = normalizeMemoryModelFields(
        values.memoryLayerExtractorModel,
        values.memoryLayerExtractorProvider,
        modelOptions,
      );
      const memoryPersonaWriter = normalizeMemoryModelFields(
        values.memoryPersonaWriterModel,
        values.memoryPersonaWriterProvider,
        modelOptions,
      );
      const memoryEmbedding = normalizeMemoryModelFields(
        values.memoryEmbeddingModel,
        values.memoryEmbeddingProvider,
        embeddingModelOptions,
      );
      const systemAgent = {
        ...((userGlobalSettings as any).systemAgent &&
        typeof (userGlobalSettings as any).systemAgent === 'object' &&
        !Array.isArray((userGlobalSettings as any).systemAgent)
          ? (userGlobalSettings as any).systemAgent
          : {}),
      };

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
        ...(systemAgent.followUpAction ?? {}),
        enabled: values.serviceModelFollowUpActionEnabled,
      };
      systemAgent.inputCompletion = {
        ...(systemAgent.inputCompletion ?? {}),
        enabled: values.serviceModelInputCompletionEnabled,
      };
      systemAgent.promptRewrite = {
        ...(systemAgent.promptRewrite ?? {}),
        enabled: values.serviceModelPromptRewriteEnabled,
      };

      const defaultAgent =
        (userGlobalSettings as any).defaultAgent &&
        typeof (userGlobalSettings as any).defaultAgent === 'object' &&
        !Array.isArray((userGlobalSettings as any).defaultAgent)
          ? { ...(userGlobalSettings as any).defaultAgent }
          : {};
      const defaultAgentConfig =
        defaultAgent.config &&
        typeof defaultAgent.config === 'object' &&
        !Array.isArray(defaultAgent.config)
          ? { ...defaultAgent.config }
          : {};
      delete defaultAgentConfig.model;
      delete defaultAgentConfig.provider;
      if (defaultAgentModel) Object.assign(defaultAgentConfig, defaultAgentModel);

      const shouldWriteDefaultAgent =
        Boolean(defaultAgentModel) ||
        Object.keys(defaultAgent).length > 0 ||
        Object.keys(defaultAgentConfig).length > 0;

      const mergedUserGlobalSettings = {
        ...userGlobalSettings,
        ...(shouldWriteDefaultAgent
          ? {
              defaultAgent: {
                ...defaultAgent,
                config: defaultAgentConfig,
              },
            }
          : {}),
        languageModel: languageModelDefaults,
        systemAgent,
        tool: {
          ...(userGlobalSettings as any).tool,
          uninstalledBuiltinTools: disabledBuiltinTools,
        },
      };

      const updates = [
        {
          key: SETTING_KEYS.composioEnabled,
          value: values.composioEnabled ?? false,
        },
        {
          key: SETTING_KEYS.composioAuthConfigIds,
          value: values.composioAuthConfigIds ?? '',
        },
        ...(values.composioClearApiKey || values.composioApiKey?.trim()
          ? [
              {
                key: SETTING_KEYS.composioApiKey,
                value: values.composioClearApiKey ? '' : values.composioApiKey?.trim(),
              },
            ]
          : []),
          {
            key: SETTING_KEYS.vectorEmbeddingProvider,
            value: values.vectorEmbeddingProvider,
          },
          {
            key: SETTING_KEYS.vectorEmbeddingModel,
            value: values.vectorEmbeddingModel,
          },
          {
            key: SETTING_KEYS.vectorRerankerProvider,
            value: values.vectorRerankerProvider,
          },
          {
            key: SETTING_KEYS.vectorRerankerModel,
            value: values.vectorRerankerModel,
          },
          {
            key: SETTING_KEYS.vectorQueryMode,
            value: values.vectorQueryMode,
          },
          {
            key: SETTING_KEYS.memoryUserMemoryGatekeeperProvider,
            value: memoryGatekeeper.provider,
          },
          {
            key: SETTING_KEYS.memoryUserMemoryGatekeeperModel,
            value: memoryGatekeeper.model,
          },
          {
            key: SETTING_KEYS.memoryUserMemoryLayerExtractorProvider,
            value: memoryLayerExtractor.provider,
          },
          {
            key: SETTING_KEYS.memoryUserMemoryLayerExtractorModel,
            value: memoryLayerExtractor.model,
          },
          {
            key: SETTING_KEYS.memoryUserMemoryPersonaWriterProvider,
            value: memoryPersonaWriter.provider,
          },
          {
            key: SETTING_KEYS.memoryUserMemoryPersonaWriterModel,
            value: memoryPersonaWriter.model,
          },
          {
            key: SETTING_KEYS.memoryUserMemoryEmbeddingProvider,
            value: memoryEmbedding.provider,
          },
          {
            key: SETTING_KEYS.memoryUserMemoryEmbeddingModel,
            value: memoryEmbedding.model,
          },
          {
            key: SETTING_KEYS.userGlobalSettingsDefaults,
            value: mergedUserGlobalSettings,
          },
          {
            key: SETTING_KEYS.avatarPresets,
            value: values.avatarPresets ?? [],
          },
      ];

      await adminCommercialService.setAppSettingsBatch({
        updates,
      });

      await mutate(ADMIN_SETTINGS_SWR_KEY);
      await mutate(RUNTIME_CONFIG_SWR_KEY);
      await mutate(PROFILE_INTEREST_AREAS_SWR_KEY);
      await mutate(PROFILE_OPTIONS_SWR_KEY);
      if (syncToUsers) {
        const result = await adminCommercialService.syncUserGlobalSettingsDefaultsToUsers();
        await mutate(USER_STATE_SWR_KEY);
        message.success(
          `全局默认设置已保存，并已同步 ${result.syncedUsers} 个用户的 ${result.syncedFields.length} 个设置分类`,
        );
        return;
      }
      message.success('全局默认设置已保存');
    } catch (error) {
      message.error(
        error instanceof SyntaxError ? '用户全局设置 JSON 格式不正确' : '保存失败，请检查表单内容',
      );
    } finally {
      setSubmitting(false);
      setSyncing(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 960 }}>
      <Flexbox gap={4}>
        <Title level={3} style={{ margin: 0 }}>
          向量与用户全局设置
        </Title>
        <Text type="secondary">
          统一管理知识库/记忆检索的向量模型，以及所有用户默认继承的设置。
        </Text>
      </Flexbox>

      <Form
        disabled={isLoading}
        form={form}
        layout="vertical"
        initialValues={{
          avatarPresets: DEFAULT_AVATAR_PRESETS,
          disabledBuiltinToolsText: '',
          languageModelDefaultsJson: '{}',
          serviceModelFollowUpActionEnabled: false,
          serviceModelInputCompletionEnabled: false,
          serviceModelPromptRewriteEnabled: true,
          userGlobalSettingsJson: '{}',
        }}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card title="向量检索设置">
            <Alert
              showIcon
              message="当前数据库向量列固定为 1024 维。更换 Embedding 模型前，请确认上游返回 1024 维，或支持 dimensions=1024；否则知识库、记忆检索和重建向量会失败。"
              style={{ marginBottom: 16 }}
              type="warning"
            />
            <Form.Item
              extra="留空时使用服务器 DEFAULT_FILES_CONFIG 或系统默认值。"
              label="Embedding 供应商"
              name="vectorEmbeddingProvider"
            >
              <Input placeholder="openai / newapi / jina / cohere" />
            </Form.Item>
            <Form.Item label="Embedding 模型" name="vectorEmbeddingModel">
              <Input placeholder="text-embedding-3-small" />
            </Form.Item>
            <Form.Item label="Reranker 供应商" name="vectorRerankerProvider">
              <Input placeholder="cohere / jina / newapi" />
            </Form.Item>
            <Form.Item label="Reranker 模型" name="vectorRerankerModel">
              <Input placeholder="rerank-english-v3.0" />
            </Form.Item>
            <Form.Item
              extra="保留当前系统支持的 query_mode 文本，例如 semantic、full_text、hybrid。"
              label="查询模式"
              name="vectorQueryMode"
            >
              <Select
                allowClear
                showSearch
                options={[
                  { label: 'semantic', value: 'semantic' },
                  { label: 'full_text', value: 'full_text' },
                  { label: 'hybrid', value: 'hybrid' },
                ]}
              />
            </Form.Item>
          </Card>

          <Card title="记忆分析模型设置">
            <Alert
              showIcon
              message="控制用户记忆判定、分层提取、画像生成与记忆向量检索模型。留空时沿用环境变量或系统默认值；更换记忆 Embedding 模型后，需要重建已有记忆向量。"
              style={{ marginBottom: 16 }}
              type="info"
            />
            <Flexbox horizontal gap={12}>
              <Form.Item
                extra="判断聊天内容是否需要写入长期记忆。选择候选模型时会自动填充供应商。"
                label="记忆判定模型"
                name="memoryGatekeeperModel"
                style={{ flex: 1 }}
              >
                <AutoComplete
                  allowClear
                  options={modelOptions}
                  placeholder="选择聊天模型"
                  onSelect={(value) =>
                    applySelectedModelProvider(
                      'memoryGatekeeperModel',
                      'memoryGatekeeperProvider',
                      modelOptions,
                      value,
                    )
                  }
                />
              </Form.Item>
              <Form.Item
                label="记忆判定供应商"
                name="memoryGatekeeperProvider"
                style={{ width: 220 }}
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={modelProviderOptions}
                  placeholder="newapi"
                />
              </Form.Item>
            </Flexbox>
            <Flexbox horizontal gap={12}>
              <Form.Item
                extra="提取 activity、context、experience、identity、preference 等记忆层。"
                label="分层提取模型"
                name="memoryLayerExtractorModel"
                style={{ flex: 1 }}
              >
                <AutoComplete
                  allowClear
                  options={modelOptions}
                  placeholder="选择聊天模型"
                  onSelect={(value) =>
                    applySelectedModelProvider(
                      'memoryLayerExtractorModel',
                      'memoryLayerExtractorProvider',
                      modelOptions,
                      value,
                    )
                  }
                />
              </Form.Item>
              <Form.Item
                label="分层提取供应商"
                name="memoryLayerExtractorProvider"
                style={{ width: 220 }}
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={modelProviderOptions}
                  placeholder="newapi"
                />
              </Form.Item>
            </Flexbox>
            <Flexbox horizontal gap={12}>
              <Form.Item
                extra="根据长期记忆生成和更新用户画像文档。"
                label="用户画像写入模型"
                name="memoryPersonaWriterModel"
                style={{ flex: 1 }}
              >
                <AutoComplete
                  allowClear
                  options={modelOptions}
                  placeholder="选择聊天模型"
                  onSelect={(value) =>
                    applySelectedModelProvider(
                      'memoryPersonaWriterModel',
                      'memoryPersonaWriterProvider',
                      modelOptions,
                      value,
                    )
                  }
                />
              </Form.Item>
              <Form.Item
                label="用户画像供应商"
                name="memoryPersonaWriterProvider"
                style={{ width: 220 }}
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={modelProviderOptions}
                  placeholder="newapi"
                />
              </Form.Item>
            </Flexbox>
            <Flexbox horizontal gap={12}>
              <Form.Item
                extra="用于写入和搜索用户记忆向量。当前数据库向量列固定为 1024 维。"
                label="记忆 Embedding 模型"
                name="memoryEmbeddingModel"
                style={{ flex: 1 }}
              >
                <AutoComplete
                  allowClear
                  options={embeddingModelOptions}
                  placeholder="选择 Embedding 模型"
                  onSelect={(value) =>
                    applySelectedModelProvider(
                      'memoryEmbeddingModel',
                      'memoryEmbeddingProvider',
                      embeddingModelOptions,
                      value,
                    )
                  }
                />
              </Form.Item>
              <Form.Item
                label="记忆 Embedding 供应商"
                name="memoryEmbeddingProvider"
                style={{ width: 220 }}
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={embeddingProviderOptions}
                  placeholder="siliconflow / newapi"
                />
              </Form.Item>
            </Flexbox>
          </Card>

          <Card title="Composio tool integration">
            <Alert
              showIcon
              message="Configure the optional Composio connector used by AI tool integrations such as Gmail, Notion, GitHub and Slack. Leave API Key empty to keep the current key; enable Clear API Key to remove it."
              style={{ marginBottom: 16 }}
              type="info"
            />
            <Form.Item label="Enable Composio" name="composioEnabled" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item
              extra={(data as any)?.composioConfig?.apiKeyConfigured
                ? `Current key: ${(data as any).composioConfig.apiKeyMasked || 'configured'}`
                : 'No Composio API key is configured.'}
              label="Project API Key"
              name="composioApiKey"
            >
              <Input.Password autoComplete="new-password" placeholder="ak_..." />
            </Form.Item>
            <Form.Item
              extra="Clear the saved API key on save. Keep this off when only changing other Composio settings."
              label="Clear API Key"
              name="composioClearApiKey"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              extra='Optional JSON map, for example {"gmail":"ac_xxx","github":"ac_xxx"}. Leave empty to let Composio create or discover auth configs.'
              label="Auth Config IDs"
              name="composioAuthConfigIds"
            >
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} placeholder='{"gmail":"ac_xxx"}' />
            </Form.Item>
          </Card>

          <Card title="用户全局默认设置">
            <Alert
              showIcon
              message="这里的 JSON 会并入前端 defaultSettings，对新老用户都作为默认值生效；用户自己保存过的设置仍优先。站点设置里的默认助手、默认图像/视频模型会覆盖这里同名字段。"
              style={{ marginBottom: 16 }}
              type="info"
            />
            <Form.Item
              extra="写入 userDefaults.defaultAgent.config。用户打开“服务模型”页时会先看到后台默认值，之后可以保存自己的模型选择。"
              label="默认助手模型"
              name="serviceModelDefaultAgent"
            >
              <Select allowClear showSearch options={modelOptions} placeholder="选择聊天模型" />
            </Form.Item>
            <Form.Item extra="用于自动生成话题标题。" label="话题命名模型" name="serviceModelTopic">
              <Select allowClear showSearch options={modelOptions} placeholder="选择聊天模型" />
            </Form.Item>
            <Form.Item
              extra="用于图像/视频/PPT 等生成主题的自动命名。"
              label="生成主题命名模型"
              name="serviceModelGenerationTopic"
            >
              <Select allowClear showSearch options={modelOptions} placeholder="选择聊天模型" />
            </Form.Item>
            <Form.Item extra="用于消息翻译。" label="消息翻译模型" name="serviceModelTranslation">
              <Select allowClear showSearch options={modelOptions} placeholder="选择聊天模型" />
            </Form.Item>
            <Form.Item
              extra="用于压缩长对话历史。"
              label="历史压缩模型"
              name="serviceModelHistoryCompress"
            >
              <Select allowClear showSearch options={modelOptions} placeholder="选择聊天模型" />
            </Form.Item>
            <Form.Item
              extra="用于生成助理资料、描述和元信息。"
              label="助理资料生成模型"
              name="serviceModelAgentMeta"
            >
              <Select allowClear showSearch options={modelOptions} placeholder="选择聊天模型" />
            </Form.Item>
            <Form.Item extra="用于子话题命名。" label="子话题命名模型" name="serviceModelThread">
              <Select allowClear showSearch options={modelOptions} placeholder="选择聊天模型" />
            </Form.Item>
            <Flexbox horizontal gap={12}>
              <Form.Item
                extra="用于生成聊天后的追问建议。"
                label="追问建议模型"
                name="serviceModelFollowUpAction"
                style={{ flex: 1 }}
              >
                <Select allowClear showSearch options={modelOptions} placeholder="选择聊天模型" />
              </Form.Item>
              <Form.Item
                label="启用追问建议"
                name="serviceModelFollowUpActionEnabled"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Flexbox>
            <Flexbox horizontal gap={12}>
              <Form.Item
                extra="用于输入框智能补全。"
                label="输入建议模型"
                name="serviceModelInputCompletion"
                style={{ flex: 1 }}
              >
                <Select allowClear showSearch options={modelOptions} placeholder="选择聊天模型" />
              </Form.Item>
              <Form.Item
                label="启用输入建议"
                name="serviceModelInputCompletionEnabled"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Flexbox>
            <Flexbox horizontal gap={12}>
              <Form.Item
                extra="用于改写用户提示词。"
                label="提示词改写模型"
                name="serviceModelPromptRewrite"
                style={{ flex: 1 }}
              >
                <Select allowClear showSearch options={modelOptions} placeholder="选择聊天模型" />
              </Form.Item>
              <Form.Item
                label="启用提示词改写"
                name="serviceModelPromptRewriteEnabled"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Flexbox>
            <Form.Item
              extra="写入 userDefaults.languageModel，用于所有用户的服务模型默认配置；用户自己保存过的设置优先。"
              label="服务模型默认设置 JSON"
              name="languageModelDefaultsJson"
              rules={[{ required: true, message: '请填写 JSON 对象，留空请填 {}' }]}
            >
              <Input.TextArea
                rows={8}
                spellCheck={false}
                placeholder={`{
  "openAI": { "enabled": true },
  "newapi": { "enabled": true }
}`}
              />
            </Form.Item>
            <Form.Item
              extra="每行一个工具或技能 identifier。留空表示默认不禁用，用户仍可在技能管理中自行调整。"
              label="默认禁用的内置技能/工具"
              name="disabledBuiltinToolsText"
            >
              <Input.TextArea placeholder="web-browsing" rows={4} spellCheck={false} />
            </Form.Item>
            <Form.Item
              label="默认设置 JSON"
              name="userGlobalSettingsJson"
              rules={[{ required: true, message: '请填写 JSON 对象，留空请填 {}' }]}
            >
              <Input.TextArea
                rows={12}
                spellCheck={false}
                placeholder={`{
  "general": { "language": "zh-CN" },
  "memory": { "enabled": true },
  "notification": { "inbox": true }
}`}
              />
            </Form.Item>
          </Card>

          <Card title="用户头像预设">
            <Form.List name="avatarPresets">
              {(fields, { add, remove }) => (
                <Flexbox gap={8}>
                  {fields.map(({ key, name, ...restField }) => (
                    <Flexbox horizontal align="center" gap={8} key={key}>
                      <Form.Item noStyle shouldUpdate>
                        {() => {
                          const value = form.getFieldValue(['avatarPresets', name, 'value']);
                          return <Avatar avatar={value} size={32} title="" />;
                        }}
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        noStyle
                        name={[name, 'label']}
                        rules={[{ message: '请填写名称', required: true }]}
                      >
                        <Input placeholder="名称" style={{ flex: 1 }} />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        noStyle
                        name={[name, 'value']}
                        rules={[{ message: '请填写头像地址', required: true }]}
                      >
                        <ImageUrlUploadInput
                          placeholder="/images/avatar-presets/avatar-1.svg"
                          publicUrlPrefix={uploadPublicUrlPrefix}
                          style={{ flex: 2 }}
                        />
                      </Form.Item>
                      <MinusCircleOutlined
                        style={{ color: '#ff4d4f' }}
                        onClick={() => remove(name)}
                      />
                    </Flexbox>
                  ))}
                  <Button
                    block
                    icon={<PlusOutlined />}
                    type="dashed"
                    onClick={() => add({ label: '', value: '' })}
                  >
                    添加头像
                  </Button>
                </Flexbox>
              )}
            </Form.List>
          </Card>

          <Flexbox horizontal gap={8} wrap="wrap">
            <Button loading={submitting && !syncing} type="primary" onClick={() => handleSave()}>
              保存设置
            </Button>
            <Button
              danger
              loading={syncing}
              onClick={() => {
                Modal.confirm({
                  cancelText: '取消',
                  content:
                    '这会先保存当前后台默认值，然后覆盖同步到所有现有用户的对应设置分类。用户之后仍可自行修改；下次后台同步会再次覆盖。',
                  okButtonProps: { danger: true },
                  okText: '保存并同步',
                  title: '同步后台默认值到用户设置？',
                  onOk: () => handleSave({ syncToUsers: true }),
                });
              }}
            >
              保存并同步到用户设置
            </Button>
          </Flexbox>
        </Space>
      </Form>
    </Flexbox>
  );
});

AdminSystemDefaultsPage.displayName = 'AdminSystemDefaultsPage';

export default AdminSystemDefaultsPage;
