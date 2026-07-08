'use client';

import type { PlatformPluginAdminUpsertInput } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Form, Input, message, Modal, Select } from 'antd';
import { memo, useEffect } from 'react';

import BillingEditor from './BillingEditor';
import {
  buildPlatformPluginUpsertInput,
  normalizePlatformPluginFormValues,
  type PlatformPluginFormInput,
} from './formSchema';
import OperationsEditor from './OperationsEditor';
import type { AdminPlatformPluginDetail } from './types';
import { useTranslation } from 'react-i18next';

type PluginEditorModalProps = {
  initialPlugin?: AdminPlatformPluginDetail | null;
  onCancel: () => void;
  onSubmit: (input: PlatformPluginAdminUpsertInput) => Promise<void>;
  open: boolean;
  submitting?: boolean;
};

const getRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const getString = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'string' ? String(record[key]) : '';

const getNumber = (record: Record<string, unknown>, key: string, fallback: number) =>
  typeof record[key] === 'number' && Number.isFinite(record[key]) ? Number(record[key]) : fallback;

const formatJsonRecord = (value: unknown) => {
  const record = getRecord(value);
  return Object.keys(record).length > 0 ? JSON.stringify(record, null, 2) : '';
};

const buildInitialValues = (plugin?: AdminPlatformPluginDetail | null): PlatformPluginFormInput => {
  const action = plugin?.actions?.[0];
  const runtimeConfig = getRecord(action?.runtimeConfig);
  const billing = plugin?.billing;
  const operations = plugin?.operations ?? { featured: false, sortWeight: plugin?.sortOrder ?? 0 };

  return {
    actionId: action?.actionKey || '',
    actionName: action?.name || plugin?.displayName || '',
    apiBodyTemplate: formatJsonRecord(runtimeConfig.bodyTemplate),
    apiHeaders: formatJsonRecord(runtimeConfig.headers),
    apiMethod: runtimeConfig.method === 'GET' ? 'GET' : 'POST',
    apiResponsePath: getString(runtimeConfig, 'responsePath'),
    apiTimeoutMs: getNumber(runtimeConfig, 'timeoutMs', 30_000),
    apiUrl: getString(runtimeConfig, 'url'),
    artifactMimeType: getString(runtimeConfig, 'artifactMimeType') || 'text/markdown',
    artifactNameTemplate: getString(runtimeConfig, 'artifactNameTemplate') || 'plugin-result.md',
    category: plugin?.category || '',
    defaultMultiplier: billing?.defaultMultiplier ?? 1,
    description: plugin?.description || '',
    displayName: plugin?.displayName || '',
    externalApiCostCredits: billing?.externalApiCostCredits ?? 0,
    featured: operations.featured,
    fixedServiceFeeCredits: billing?.fixedServiceFeeCredits ?? 0,
    icon: plugin?.icon || 'Plug',
    id: plugin?.id,
    model: getString(runtimeConfig, 'model'),
    moduleMultiplier: action?.moduleMultiplier ?? 1,
    planBenefitSummary: operations.planBenefitSummary || '',
    promptTemplate: getString(runtimeConfig, 'promptTemplate'),
    promoLabel: operations.promoLabel || '',
    provider: getString(runtimeConfig, 'provider'),
    runtimeType: plugin?.runtimeType || 'api_action',
    slug: plugin?.slug || '',
    sortWeight: operations.sortWeight,
    status: plugin?.status || 'draft',
    tags: plugin?.tags ?? [],
    upgradeCta: operations.upgradeCta || '',
    useCase: operations.useCase || '',
  };
};

const PluginEditorModal = memo<PluginEditorModalProps>(
  ({ initialPlugin, onCancel, onSubmit, open, submitting }) => {
    const [form] = Form.useForm<PlatformPluginFormInput>();
    const { t } = useTranslation('subscription');
    const tt = (key: string) => t(key as never);
    const runtimeType = Form.useWatch('runtimeType', form) || 'api_action';

    useEffect(() => {
      if (!open) return;
      form.setFieldsValue(buildInitialValues(initialPlugin));
    }, [form, initialPlugin, open]);

    const handleOk = async () => {
      try {
        const values = await form.validateFields();
        const normalized = normalizePlatformPluginFormValues(values);
        await onSubmit(buildPlatformPluginUpsertInput(normalized));
      } catch (error) {
        if (Array.isArray((error as { errorFields?: unknown[] }).errorFields)) return;
        message.error(error instanceof Error ? error.message : '表单校验失败');
      }
    };

    return (
      <Modal
        destroyOnHidden
        confirmLoading={submitting}
        open={open}
        title={initialPlugin ? '编辑平台插件' : '新增平台插件'}
        width={760}
        onCancel={onCancel}
        onOk={handleOk}
      >
        <Form form={form} layout="vertical">
          <Flexbox horizontal gap={12}>
            <Form.Item label="插件名称" name="displayName" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder={tt('admin.platformPlugins.displayNamePlaceholder')} />
            </Form.Item>
            <Form.Item label={tt('admin.platformPlugins.slug')} name="slug" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input disabled={!!initialPlugin} placeholder={tt('admin.platformPlugins.slugPlaceholder')} />
            </Form.Item>
          </Flexbox>

          <Flexbox horizontal gap={12}>
            <Form.Item label="分类" name="category" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="productivity" />
            </Form.Item>
            <Form.Item label="图标" name="icon" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="Plug" />
            </Form.Item>
          </Flexbox>

          <Flexbox horizontal gap={12}>
            <Form.Item label="运行类型" name="runtimeType" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select
                options={[
                  { label: tt('admin.platformPlugins.apiAction'), value: 'api_action' },
                  { label: tt('admin.platformPlugins.contentGeneration'), value: 'content_generation' },
                ]}
              />
            </Form.Item>
            <Form.Item label="状态" name="status" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select
                options={[
                  { label: '草稿', value: 'draft' },
                  { label: '已发布', value: 'published' },
                  { label: '已下架', value: 'unpublished' },
                ]}
              />
            </Form.Item>
          </Flexbox>

          <Form.Item label="标签" name="tags">
            <Select mode="tags" placeholder="输入标签后回车" />
          </Form.Item>

          <Form.Item label="描述" name="description" rules={[{ required: true }]}>
            <Input.TextArea autoSize={{ maxRows: 5, minRows: 3 }} />
          </Form.Item>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>{tt('admin.platformPlugins.operations')}</div>
            <OperationsEditor />
          </div>

          <Flexbox horizontal gap={12}>
            <Form.Item label="动作 ID" name="actionId" style={{ flex: 1 }}>
              <Input placeholder="research_notes" />
            </Form.Item>
            <Form.Item label="动作名称" name="actionName" style={{ flex: 1 }}>
              <Input placeholder="Generate Research Notes" />
            </Form.Item>
          </Flexbox>

          {runtimeType === 'api_action' ? (
            <>
              <Flexbox horizontal gap={12}>
                <Form.Item label="请求方法" name="apiMethod" style={{ width: 140 }}>
                  <Select
                    options={[
                      { label: 'GET', value: 'GET' },
                      { label: 'POST', value: 'POST' },
                    ]}
                  />
                </Form.Item>
                <Form.Item label={tt('admin.platformPlugins.apiUrl')} name="apiUrl" style={{ flex: 1 }}>
                  <Input placeholder="https://api.example.com/action" />
                </Form.Item>
              </Flexbox>
              <Flexbox horizontal gap={12}>
                <Form.Item label="响应路径" name="apiResponsePath" style={{ flex: 1 }}>
                  <Input placeholder="data.result" />
                </Form.Item>
                <Form.Item label="超时毫秒" name="apiTimeoutMs" style={{ width: 180 }}>
                  <Input />
                </Form.Item>
              </Flexbox>
              <Form.Item label="请求头 JSON" name="apiHeaders">
                <Input.TextArea autoSize={{ maxRows: 6, minRows: 2 }} placeholder={'{\n  "Authorization": "Bearer {{API_KEY}}"\n}'} />
              </Form.Item>
              <Form.Item label="请求体模板 JSON" name="apiBodyTemplate">
                <Input.TextArea autoSize={{ maxRows: 6, minRows: 2 }} placeholder={'{\n  "query": "{{input}}"\n}'} />
              </Form.Item>
            </>
          ) : (
            <>
              <Flexbox horizontal gap={12}>
                <Form.Item label="服务商" name="provider" style={{ flex: 1 }}>
                  <Input placeholder="openai" />
                </Form.Item>
                <Form.Item label="模型" name="model" style={{ flex: 1 }}>
                  <Input placeholder="gpt-5-mini" />
                </Form.Item>
              </Flexbox>
              <Flexbox horizontal gap={12}>
                <Form.Item label="产物 MIME" name="artifactMimeType" style={{ flex: 1 }}>
                  <Input placeholder="text/markdown" />
                </Form.Item>
                <Form.Item label="产物文件名模板" name="artifactNameTemplate" style={{ flex: 1 }}>
                  <Input placeholder="plugin-result.md" />
                </Form.Item>
              </Flexbox>
              <Form.Item label="提示词模板" name="promptTemplate">
                <Input.TextArea autoSize={{ maxRows: 8, minRows: 4 }} />
              </Form.Item>
            </>
          )}

          <BillingEditor />
        </Form>
      </Modal>
    );
  },
);

PluginEditorModal.displayName = 'PluginEditorModal';

export default PluginEditorModal;
