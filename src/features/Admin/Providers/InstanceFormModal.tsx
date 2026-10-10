'use client';

import { Flexbox } from '@lobehub/ui';
import { Modal, Select, toast } from '@lobehub/ui/base-ui';
import { Form, Input, InputNumber, Switch } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { mutate } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { getAdminModelTypeLabel } from '../adminModelTypeLabels';
import {
  ADMIN_MODEL_API_PROVIDER_TYPES,
  type AdminModelApiProviderType,
  buildProviderInstancePayload,
  getDefaultBaseUrlForAdminProviderType,
  resolveProviderPricingPolicyForForm,
} from '../adminProviderInstanceForm';
import { GroupFieldsRow } from './GroupFieldsRow';
import { type InstanceRow, INSTANCES_KEY, MODEL_TYPES, PROVIDER_TYPE_LABELS } from './shared';

const InstanceFormModal = memo<{
  initial?: InstanceRow | null;
  onClose: () => void;
  open: boolean;
}>(({ initial, onClose, open }) => {
  const { t } = useTranslation('subscription');
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!initial;
  const providerType = Form.useWatch('providerType', form) as AdminModelApiProviderType | undefined;
  const providerTypeOptions = useMemo(
    () =>
      ADMIN_MODEL_API_PROVIDER_TYPES.map((type) => ({
        label: PROVIDER_TYPE_LABELS[type],
        value: type,
      })),
    [],
  );
  const usageScopeOptions = useMemo(
    () =>
      MODEL_TYPES.map((type) => ({
        label: t(`admin.providers.modelType.${type}`, getAdminModelTypeLabel(type)),
        value: type,
      })),
    [t],
  );

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = buildProviderInstancePayload(values, { isEdit });
      if (isEdit && initial) {
        await adminCommercialService.updateAiProviderInstance({
          data: payload as any,
          id: initial.id,
        });
      } else {
        await adminCommercialService.createAiProviderInstance(payload as any);
      }
      toast.success(t('admin.providers.saveSuccess', '已保存'));
      await mutate(INSTANCES_KEY);
      onClose();
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      toast.error(t('admin.providers.saveFailed', '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleProviderTypeChange = (nextProviderType: AdminModelApiProviderType) => {
    const currentBaseUrl = form.getFieldValue('baseUrl');
    const defaultBaseUrl = getDefaultBaseUrlForAdminProviderType(nextProviderType);
    if (!currentBaseUrl && defaultBaseUrl) {
      form.setFieldValue('baseUrl', defaultBaseUrl);
    }
    form.setFieldValue(
      'pricingPolicy',
      resolveProviderPricingPolicyForForm({ newInstance: true, providerType: nextProviderType }),
    );
  };

  return (
    <Modal
      destroyOnHidden
      confirmLoading={submitting}
      open={open}
      width={560}
      afterOpenChange={(visible: boolean) => {
        if (visible) {
          form.setFieldsValue(
            initial
              ? {
                  ...initial,
                  apiKey: initial.apiKeyStatus === 'invalid' ? '' : initial.apiKey,
                  pricingPolicy: resolveProviderPricingPolicyForForm({
                    metadata: initial.metadata,
                    providerType: initial.providerType,
                  }),
                }
              : {
                  apiKey: '',
                  baseUrl: '',
                  description: '',
                  enabled: true,
                  fetchOnClient: false,
                  groupKey: 'default',
                  groupMultiplier: undefined,
                  groupName: '',
                  name: '',
                  pricingPolicy: resolveProviderPricingPolicyForForm({ newInstance: true }),
                  priority: 0,
                  providerType: 'newapi',
                  usageScope: [],
                },
          );
        }
      }}
      title={
        isEdit
          ? t('admin.providers.modal.editInstance', '编辑实例')
          : t('admin.providers.modal.createInstance', '新建实例')
      }
      onCancel={onClose}
      onOk={handleOk}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={t('admin.providers.field.providerType', '服务商类型')}
          name="providerType"
          extra={
            providerType === 'newapi'
              ? t(
                  'admin.providers.field.providerTypeNewapiHint',
                  'AI 服务商网关支持同步模型和价格。',
                )
              : providerType === 'sub2api'
                ? t(
                    'admin.providers.field.providerTypeSub2apiHint',
                    'Sub2API 会从密钥计费信息和模型广场同步可确认的价格。',
                  )
                : t(
                    'admin.providers.field.providerTypeOpenaiHint',
                    'OpenAI 兼容、Claude 和 OpenCode Go 格式支持同步模型；价格需要在计费矩阵中配置。',
                  )
          }
        >
          <Select options={providerTypeOptions} onChange={handleProviderTypeChange} />
        </Form.Item>
        <Flexbox horizontal gap={24} wrap={'wrap'}>
          <Form.Item
            label={t('admin.providers.field.upstreamPricing', '同步上游价格')}
            name={['pricingPolicy', 'upstreamSyncEnabled']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label={t('admin.providers.field.lobeHubOfficialPricing', '使用 LobeHub 官方价格')}
            name={['pricingPolicy', 'lobeHubOfficialPricingEnabled']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label={t('admin.providers.field.modelBankFallback', '按模型名使用系统价格')}
            name={['pricingPolicy', 'modelBankFallbackEnabled']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Flexbox>
        <Form.Item
          label={t('admin.providers.field.name', '名称')}
          name="name"
          rules={[
            { message: t('admin.providers.field.nameRequired', '请填写名称'), required: true },
          ]}
        >
          <Input placeholder="Default" />
        </Form.Item>
        <Form.Item
          label={t('admin.providers.field.baseUrl', '基础地址（Base URL）')}
          name="baseUrl"
          rules={[
            {
              message: t('admin.providers.field.baseUrlRequired', '请填写基础地址'),
              required: true,
            },
            { type: 'url' },
          ]}
        >
          <Input placeholder="https://api.example.com" />
        </Form.Item>
        <Form.Item
          label={t('admin.providers.field.apiKey', 'API 密钥（API Key）')}
          name="apiKey"
          rules={isEdit ? [] : [{ required: true }]}
          extra={
            isEdit && initial?.apiKeyStatus === 'invalid'
              ? t(
                  'admin.providers.field.apiKeyInvalidHint',
                  '当前密钥无法解密，请填写新的 API Key 后保存。',
                )
              : isEdit
                ? t(
                    'admin.providers.field.apiKeyEditHint',
                    '留空表示保持现有密钥不变；填写新密钥会替换当前密钥。',
                  )
                : undefined
          }
        >
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Flexbox horizontal gap={12}>
          <Form.Item
            label={t('admin.providers.field.priority', '优先级')}
            name="priority"
            style={{ flex: 1 }}
            extra={t(
              'admin.providers.field.priorityHint',
              '数字越小优先级越高，用于路由和故障切换。',
            )}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label={t('admin.providers.field.enabled', '启用')}
            name="enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            hidden
            label={t('admin.providers.field.fetchOnClient', '客户端拉取')}
            name="fetchOnClient"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Flexbox>
        <GroupFieldsRow />
        <Form.Item
          label={t('admin.providers.field.usageScope', '用途范围')}
          name="usageScope"
          extra={t(
            'admin.providers.field.usageScopeHint',
            '为空表示不限用途；填写后该实例只承接选中的模型类型。',
          )}
        >
          <Select
            allowClear
            mode="multiple"
            options={usageScopeOptions}
            placeholder={t('admin.providers.field.usageScopePlaceholder', '不限用途')}
          />
        </Form.Item>
        <Form.Item label={t('admin.providers.field.description', '描述')} name="description">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
});

InstanceFormModal.displayName = 'InstanceFormModal';

export default InstanceFormModal;
