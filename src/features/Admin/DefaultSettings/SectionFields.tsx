'use client';

import { Flexbox } from '@lobehub/ui';
import { Select } from '@lobehub/ui/base-ui';
import type { FormInstance } from 'antd';
import { Alert, Form, Input, Switch } from 'antd';

import { Card } from '@/components/antd-compat/Card';
import type { DefaultModelOption } from '@/features/Admin/adminSettingsForm';
import RuntimeModelFieldPair from '@/features/Admin/components/RuntimeModelFieldPair';

import { ProfileDefaultsCard } from './ProfileDefaultsCard';
import type { FormValues } from './shared';
import { userModelFields } from './shared';

type ModelOption = DefaultModelOption;

interface SectionFieldsProps {
  embeddingModelOptions: ModelOption[];
  form: FormInstance<FormValues>;
  modelOptions: ModelOption[];
  rerankerModelOptions: ModelOption[];
}

export const RuntimeFields = ({
  embeddingModelOptions,
  form,
  modelOptions,
  rerankerModelOptions,
}: SectionFieldsProps) => (
  <>
    <Card title="向量检索设置">
      <Alert
        showIcon
        message="当前数据库向量列固定为 1024 维。更换 Embedding 模型前，请确认上游返回 1024 维，或支持 dimensions=1024。"
        style={{ marginBottom: 16 }}
        type="warning"
      />
      <RuntimeModelFieldPair
        extra="留空时使用服务器或系统默认值。"
        form={form}
        modelField="vectorEmbeddingModel"
        modelLabel="Embedding 模型"
        options={embeddingModelOptions}
        placeholder="选择 Embedding 模型"
        providerField="vectorEmbeddingProvider"
        providerLabel="Embedding 供应商"
      />
      <RuntimeModelFieldPair
        form={form}
        modelField="vectorRerankerModel"
        modelLabel="Reranker 模型"
        options={rerankerModelOptions}
        placeholder="选择 Reranker 模型"
        providerField="vectorRerankerProvider"
        providerLabel="Reranker 供应商"
      />
      <Form.Item extra="使用当前系统支持的 query_mode。" label="查询模式" name="vectorQueryMode">
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
        message="配置用户记忆判定、分层提取、画像生成和记忆向量检索模型。更换 Embedding 模型后，需重建已有记忆向量。"
        style={{ marginBottom: 16 }}
        type="info"
      />
      <RuntimeModelFieldPair
        extra="判断聊天内容是否需要写入长期记忆。"
        form={form}
        modelField="memoryGatekeeperModel"
        modelLabel="记忆判定模型"
        options={modelOptions}
        placeholder="选择聊天模型"
        providerField="memoryGatekeeperProvider"
        providerLabel="记忆判定供应商"
      />
      <RuntimeModelFieldPair
        extra="提取 activity、context、experience 等记忆层。"
        form={form}
        modelField="memoryLayerExtractorModel"
        modelLabel="分层提取模型"
        options={modelOptions}
        placeholder="选择聊天模型"
        providerField="memoryLayerExtractorProvider"
        providerLabel="分层提取供应商"
      />
      <RuntimeModelFieldPair
        extra="根据长期记忆生成和更新用户画像。"
        form={form}
        modelField="memoryPersonaWriterModel"
        modelLabel="用户画像写入模型"
        options={modelOptions}
        placeholder="选择聊天模型"
        providerField="memoryPersonaWriterProvider"
        providerLabel="用户画像供应商"
      />
      <RuntimeModelFieldPair
        extra="用于写入和搜索用户记忆向量。"
        form={form}
        modelField="memoryEmbeddingModel"
        modelLabel="记忆 Embedding 模型"
        options={embeddingModelOptions}
        placeholder="选择 Embedding 模型"
        providerField="memoryEmbeddingProvider"
        providerLabel="记忆 Embedding 供应商"
      />
    </Card>
  </>
);

interface IntegrationFieldsProps {
  settings?: {
    composioConfig?: {
      apiKeyConfigured?: boolean;
      apiKeyMasked?: string;
    };
  };
}

export const IntegrationFields = ({ settings }: IntegrationFieldsProps) => (
  <Card title="Composio tool integration">
    <Alert
      showIcon
      message="配置 Gmail、Notion、GitHub 和 Slack 等 AI 工具的可选 Composio 连接器。API Key 留空会保留现有密钥。"
      style={{ marginBottom: 16 }}
      type="info"
    />
    <Form.Item label="启用 Composio" name="composioEnabled" valuePropName="checked">
      <Switch />
    </Form.Item>
    <Form.Item
      label="Project API Key"
      name="composioApiKey"
      extra={
        settings?.composioConfig?.apiKeyConfigured
          ? `当前密钥：${settings.composioConfig.apiKeyMasked || '已配置'}`
          : '尚未配置 Composio API Key。'
      }
    >
      <Input.Password autoComplete="new-password" placeholder="ak_..." />
    </Form.Item>
    <Form.Item
      extra="开启后会在保存时清除已保存的 API Key。"
      label="清除 API Key"
      name="composioClearApiKey"
      valuePropName="checked"
    >
      <Switch />
    </Form.Item>
    <Form.Item
      extra='可选 JSON 映射，例如 {"gmail":"ac_xxx","github":"ac_xxx"}。'
      label="Auth Config IDs"
      name="composioAuthConfigIds"
    >
      <Input.TextArea autoSize={{ maxRows: 6, minRows: 2 }} placeholder='{"gmail":"ac_xxx"}' />
    </Form.Item>
  </Card>
);

interface UserDefaultsFieldsProps {
  form: FormInstance<FormValues>;
  modelOptions: ModelOption[];
  uploadPublicUrlPrefix?: string;
}

export const UserDefaultsFields = ({
  form,
  modelOptions,
  uploadPublicUrlPrefix,
}: UserDefaultsFieldsProps) => (
  <>
    <Card title="用户全局默认设置">
      <Alert
        showIcon
        message="这些值会与新用户的默认设置合并。用户自行保存过的设置仍优先。"
        style={{ marginBottom: 16 }}
        type="info"
      />
      {userModelFields.map(({ extra, field, label }) => (
        <Form.Item extra={extra} key={field} label={label} name={field}>
          <Select allowClear showSearch options={modelOptions} placeholder="选择聊天模型" />
        </Form.Item>
      ))}
      {[
        [
          'serviceModelFollowUpAction',
          'serviceModelFollowUpActionEnabled',
          '追问建议模型',
          '启用追问建议',
        ],
        [
          'serviceModelInputCompletion',
          'serviceModelInputCompletionEnabled',
          '输入建议模型',
          '启用输入建议',
        ],
        [
          'serviceModelPromptRewrite',
          'serviceModelPromptRewriteEnabled',
          '提示词改写模型',
          '启用提示词改写',
        ],
      ].map(([modelField, enabledField, label, enabledLabel]) => (
        <Flexbox horizontal gap={12} key={modelField}>
          <Form.Item label={label} name={modelField as keyof FormValues} style={{ flex: 1 }}>
            <Select allowClear showSearch options={modelOptions} placeholder="选择聊天模型" />
          </Form.Item>
          <Form.Item
            label={enabledLabel}
            name={enabledField as keyof FormValues}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Flexbox>
      ))}
      <Form.Item
        extra="写入 userDefaults.languageModel。"
        label="服务模型默认设置 JSON"
        name="languageModelDefaultsJson"
        rules={[{ message: '请填写 JSON 对象，留空请填 {}', required: true }]}
      >
        <Input.TextArea rows={8} spellCheck={false} />
      </Form.Item>
      <Form.Item
        extra="每行一个工具或技能 identifier；留空表示默认不禁用。"
        label="默认禁用的内置技能/工具"
        name="disabledBuiltinToolsText"
      >
        <Input.TextArea placeholder="web-browsing" rows={4} spellCheck={false} />
      </Form.Item>
      <Form.Item
        label="默认设置 JSON"
        name="userGlobalSettingsJson"
        rules={[{ message: '请填写 JSON 对象，留空请填 {}', required: true }]}
      >
        <Input.TextArea rows={12} spellCheck={false} />
      </Form.Item>
    </Card>
    <ProfileDefaultsCard form={form} uploadPublicUrlPrefix={uploadPublicUrlPrefix} />
  </>
);
