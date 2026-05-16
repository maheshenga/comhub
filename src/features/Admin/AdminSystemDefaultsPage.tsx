'use client';

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Avatar, Flexbox } from '@lobehub/ui';
import { Alert, Button, Form, Input, message, Select, Space, Typography } from 'antd';
import { memo, useEffect, useState } from 'react';

import { Card } from '@/components/antd-compat/Card';
import {
  ADMIN_SETTINGS_SWR_KEY,
  PROFILE_INTEREST_AREAS_SWR_KEY,
  PROFILE_OPTIONS_SWR_KEY,
  RUNTIME_CONFIG_SWR_KEY,
} from '@/const/adminCacheKeys';
import { type AvatarPreset, DEFAULT_AVATAR_PRESETS } from '@/const/avatarPresets';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text, Title } = Typography;

const SETTING_KEYS = {
  avatarPresets: 'profile.avatarPresets',
  userGlobalSettingsDefaults: 'user.globalSettings.defaults',
  vectorEmbeddingModel: 'vector.embedding.model',
  vectorEmbeddingProvider: 'vector.embedding.provider',
  vectorQueryMode: 'vector.queryMode',
  vectorRerankerModel: 'vector.reranker.model',
  vectorRerankerProvider: 'vector.reranker.provider',
} as const;

type FormValues = {
  avatarPresets: AvatarPreset[];
  disabledBuiltinToolsText: string;
  languageModelDefaultsJson: string;
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

const AdminSystemDefaultsPage = memo(() => {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const { data, isLoading } = useClientDataSWR(ADMIN_SETTINGS_SWR_KEY, () =>
    adminCommercialService.getAllSettings(),
  );

  useEffect(() => {
    if (!data) return;

    const vectorConfig = (data as any).vectorConfig ?? {};
    const userDefaults = (data as any).userGlobalSettingsDefaults ?? {};
    form.setFieldsValue({
      avatarPresets: (data as any).avatarPresets ?? DEFAULT_AVATAR_PRESETS,
      disabledBuiltinToolsText: Array.isArray(userDefaults?.tool?.uninstalledBuiltinTools)
        ? userDefaults.tool.uninstalledBuiltinTools.join('\n')
        : '',
      languageModelDefaultsJson: jsonStringify(userDefaults?.languageModel ?? {}),
      userGlobalSettingsJson: jsonStringify(userDefaults),
      vectorEmbeddingModel: vectorConfig.embeddingModel ?? '',
      vectorEmbeddingProvider: vectorConfig.embeddingProvider ?? '',
      vectorQueryMode: vectorConfig.queryMode ?? '',
      vectorRerankerModel: vectorConfig.rerankerModel ?? '',
      vectorRerankerProvider: vectorConfig.rerankerProvider ?? '',
    });
  }, [data, form]);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      const userGlobalSettings = parseJsonObject(values.userGlobalSettingsJson);
      const languageModelDefaults = parseJsonObject(values.languageModelDefaultsJson);
      const disabledBuiltinTools = splitTextList(values.disabledBuiltinToolsText);
      const mergedUserGlobalSettings = {
        ...userGlobalSettings,
        languageModel: languageModelDefaults,
        tool: {
          ...(userGlobalSettings as any).tool,
          uninstalledBuiltinTools: disabledBuiltinTools,
        },
      };

      await Promise.all([
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.vectorEmbeddingProvider,
          value: values.vectorEmbeddingProvider,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.vectorEmbeddingModel,
          value: values.vectorEmbeddingModel,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.vectorRerankerProvider,
          value: values.vectorRerankerProvider,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.vectorRerankerModel,
          value: values.vectorRerankerModel,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.vectorQueryMode,
          value: values.vectorQueryMode,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.userGlobalSettingsDefaults,
          value: mergedUserGlobalSettings,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.avatarPresets,
          value: values.avatarPresets ?? [],
        }),
      ]);

      await mutate(ADMIN_SETTINGS_SWR_KEY);
      await mutate(RUNTIME_CONFIG_SWR_KEY);
      await mutate(PROFILE_INTEREST_AREAS_SWR_KEY);
      await mutate(PROFILE_OPTIONS_SWR_KEY);
      message.success('全局默认设置已保存');
    } catch (error) {
      message.error(
        error instanceof SyntaxError ? '用户全局设置 JSON 格式不正确' : '保存失败，请检查表单内容',
      );
    } finally {
      setSubmitting(false);
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

          <Card title="用户全局默认设置">
            <Alert
              showIcon
              message="这里的 JSON 会并入前端 defaultSettings，对新老用户都作为默认值生效；用户自己保存过的设置仍优先。站点设置里的默认助手、默认图像/视频模型会覆盖这里同名字段。"
              style={{ marginBottom: 16 }}
              type="info"
            />
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
                        <Input
                          placeholder="/images/avatar-presets/avatar-1.svg"
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

          <Button loading={submitting} type="primary" onClick={handleSave}>
            保存设置
          </Button>
        </Space>
      </Form>
    </Flexbox>
  );
});

AdminSystemDefaultsPage.displayName = 'AdminSystemDefaultsPage';

export default AdminSystemDefaultsPage;
