'use client';

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Flexbox } from '@lobehub/ui';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Space,
  Typography,
} from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  SETTINGS_DEFAULT_MODEL_NOTICE,
  SETTINGS_SUBTITLE,
} from '@/features/Admin/adminSettingsCopy';
import {
  ADMIN_SETTINGS_SWR_KEY,
  type AdminSettingsFormValues,
  buildFormValues,
  buildModelOptions,
  buildSettingUpdates,
  getAdminSettingsRefreshKeys,
  normalizeText,
} from '@/features/Admin/adminSettingsForm';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text, Title } = Typography;

const providerOptions = ['newapi', 'openai', 'anthropic', 'google', 'deepseek', 'ollama'].map(
  (value) => ({ label: value, value }),
);

const AdminSettingsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useClientDataSWR(ADMIN_SETTINGS_SWR_KEY, () =>
    adminCommercialService.getAllSettings(),
  );
  const [form] = Form.useForm<AdminSettingsFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{
    auditCutoff?: string;
    auditLogsDeleted?: number;
    pendingOrdersCutoff?: string;
    pendingOrdersExpired?: number;
  } | null>(null);

  const watchedValues = Form.useWatch([], form) as Partial<AdminSettingsFormValues> | undefined;

  const initialValues = useMemo(() => buildFormValues(data), [data]);
  const pendingUpdates = buildSettingUpdates(watchedValues ?? initialValues, initialValues);
  const hasPendingChanges = pendingUpdates.length > 0;
  const defaultModelOptions = buildModelOptions(data);
  const paymentGatewayStatus = data?.paymentGatewayStatus;

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue(buildFormValues(data));
  }, [data, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const updates = buildSettingUpdates(values, initialValues);

      if (updates.length === 0) {
        message.info(t('admin.settings.noChanges', '没有需要保存的变更'));
        return;
      }

      setSubmitting(true);
      await Promise.all(updates.map((update) => adminCommercialService.setAppSetting(update)));
      form.setFieldValue('cronSecret', '');
      await mutate(ADMIN_SETTINGS_SWR_KEY);

      const refreshKeys = getAdminSettingsRefreshKeys(updates);
      for (const key of refreshKeys) {
        await mutate(key);
      }

      message.success(
        refreshKeys.length > 0
          ? t(
              'admin.settings.saveSuccessWithRuntimeRefresh',
              '设置已保存，默认模型配置已刷新到当前会话',
            )
          : t('admin.settings.saveSuccess', '设置已保存'),
      );
    } catch {
      message.error(t('admin.settings.saveFailed', '保存失败，请检查表单内容'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const result = await adminCommercialService.runMaintenance();
      setRunResult(result);
      message.success(t('admin.settings.runSuccess', '维护任务已执行'));
    } catch {
      message.error(t('admin.settings.runFailed', '维护任务执行失败'));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 920 }}>
      <Flexbox gap={4}>
        <Title level={3} style={{ margin: 0 }}>
          {t('admin.settings.title', '站点与 API 设置')}
        </Title>
        <Text type="secondary">
          {t('admin.settings.subtitle', SETTINGS_SUBTITLE)}
        </Text>
      </Flexbox>

      <Alert
        showIcon
        message={t('admin.settings.defaultModelNotice', SETTINGS_DEFAULT_MODEL_NOTICE)}
        type="info"
      />

      <Form disabled={isLoading} form={form} layout="vertical">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card title={t('admin.settings.brandSection', '品牌展示')}>
            <Form.Item
              extra={t('admin.settings.brandName.help', '用于登录页、加载页、标题和站内品牌展示。')}
              label={t('admin.settings.brandName', '品牌名称')}
              name="brandName"
            >
              <Input placeholder="青柚 AI" />
            </Form.Item>
            <Form.Item label={t('admin.settings.brandSlogan', '品牌标语')} name="brandSlogan">
              <Input placeholder={t('admin.settings.brandSlogan.placeholder', '可选的副标题')} />
            </Form.Item>
            <Form.Item
              label={t('admin.settings.brandLogoUrl', 'Logo 地址（URL）')}
              name="brandLogoUrl"
            >
              <Input placeholder="https://.../logo.svg" />
            </Form.Item>
            <Form.Item
              label={t('admin.settings.brandFaviconUrl', '网站图标地址（Favicon URL）')}
              name="brandFaviconUrl"
            >
              <Input placeholder="https://.../favicon.ico" />
            </Form.Item>
            <Form.Item
              extra={t('admin.settings.brandPrimary.help', '填写十六进制颜色值，例如 #1677ff。')}
              label={t('admin.settings.brandPrimaryColor', '主题主色')}
              name="brandPrimaryColor"
            >
              <Input placeholder="#1677ff" />
            </Form.Item>
          </Card>

          <Card title={t('admin.settings.gatewaySection', '模型与 API 默认设置')}>
            <Form.Item
              label={t('admin.settings.defaultProvider', '默认供应商（Provider）')}
              name="defaultAgentProvider"
              extra={t(
                'admin.settings.defaultProvider.help',
                '使用 NewAPI 中转站时填写 newapi。该值会写入后端默认助手配置。',
              )}
            >
              <AutoComplete
                options={providerOptions}
                filterOption={(inputValue, option) =>
                  option?.value?.toLowerCase().includes(inputValue.toLowerCase()) ?? false
                }
              >
                <Input
                  allowClear
                  placeholder="newapi"
                  onBlur={() =>
                    form.setFieldValue(
                      'defaultAgentProvider',
                      normalizeText(form.getFieldValue('defaultAgentProvider')),
                    )
                  }
                />
              </AutoComplete>
            </Form.Item>
            <Form.Item
              label={t('admin.settings.defaultModel', '默认模型（Model）')}
              name="defaultAgentModel"
              extra={t(
                'admin.settings.defaultModel.help',
                '建议从已启用模型目录中选择；也可以手动输入网关支持的模型 ID。',
              )}
            >
              <AutoComplete
                options={defaultModelOptions}
                filterOption={(inputValue, option) =>
                  String(option?.label ?? option?.value ?? '')
                    .toLowerCase()
                    .includes(inputValue.toLowerCase())
                }
                onSelect={(value) => {
                  const selected = defaultModelOptions.find((item) => item.value === value);
                  if (!selected) return;

                  form.setFieldValue('defaultAgentProvider', selected.provider);
                  form.setFieldValue('defaultAgentModel', selected.model);
                }}
              >
                <Input
                  allowClear
                  placeholder="deepseek-chat"
                  onBlur={() =>
                    form.setFieldValue(
                      'defaultAgentModel',
                      normalizeText(form.getFieldValue('defaultAgentModel')),
                    )
                  }
                />
              </AutoComplete>
            </Form.Item>
          </Card>

          <Card title={t('admin.settings.paymentSection', '支付网关状态')}>
            <Alert
              showIcon
              type={paymentGatewayStatus?.configured ? 'success' : 'warning'}
              message={
                paymentGatewayStatus?.message ||
                '支付网关尚未接入，用户自助支付暂不可用。当前可以在后台手动结算订单。'
              }
            />
          </Card>

          <Card title={t('admin.settings.growthSection', '增长与推荐')}>
            <Form.Item
              label={t('admin.settings.referralReward', '推荐奖励积分')}
              name="referralRewardCredits"
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Card>

          <Card title={t('admin.settings.cronSection', '系统维护')}>
            <Form.Item
              label={t('admin.settings.cronSecret', 'Cron Bearer 密钥')}
              name="cronSecret"
              extra={
                data?.cronSecretConfigured
                  ? `${t('admin.settings.current', '当前值')}: ${data.cronSecretMasked}`
                  : t('admin.settings.notSet', '未配置')
              }
            >
              <Input.Password placeholder={t('admin.settings.leaveBlank', '留空则保持当前值')} />
            </Form.Item>
            <Form.Item
              label={t('admin.settings.auditRetention', '审计日志保留天数')}
              name="cronAuditRetentionDays"
              extra={t(
                'admin.settings.auditRetention.help',
                '超过该天数的后台审计日志会被删除，范围 7-3650 天。',
              )}
            >
              <InputNumber max={3650} min={7} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('admin.settings.pendingOrderExpiry', '待支付订单过期天数')}
              name="cronPendingOrderExpiryDays"
              extra={t(
                'admin.settings.pendingOrderExpiry.help',
                '超过该天数的待支付充值订单会自动过期，范围 1-365 天。',
              )}
            >
              <InputNumber max={365} min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Button loading={running} onClick={handleRunNow}>
              {t('admin.settings.runNow', '立即执行维护')}
            </Button>
          </Card>

          <Card title={t('admin.settings.clientSection', '客户端入口')}>
            <Form.Item
              label={t('admin.settings.desktopDownloadUrl', '桌面端下载地址（URL）')}
              name="desktopDownloadUrl"
              extra={t(
                'admin.settings.desktopDownloadUrl.help',
                '用于覆盖用户面板中的桌面端下载链接。留空则使用内置地址。',
              )}
            >
              <Input placeholder="https://example.com/download" />
            </Form.Item>
            <Form.Item
              label={t('admin.settings.desktopDownloadLabel', '下载按钮文案')}
              name="desktopDownloadLabel"
              extra={t(
                'admin.settings.desktopDownloadLabel.help',
                '显示在客户端下载入口的按钮文案。',
              )}
            >
              <Input placeholder="下载桌面端应用" />
            </Form.Item>
          </Card>

          <Card title={t('admin.settings.helpMenuSection', '帮助菜单')}>
            <Form.Item
              label={t('admin.settings.helpMenuItems', '菜单项')}
              extra={t(
                'admin.settings.helpMenuItems.help',
                '配置客户端帮助菜单。每项需要显示名称，链接 URL 可选。',
              )}
            >
              <Form.List name="helpMenuItems">
                {(fields, { add, remove }) => (
                  <Flexbox gap={8}>
                    {fields.map(({ key, name, ...restField }) => (
                      <Flexbox horizontal align="center" gap={8} key={key}>
                        <Form.Item
                          {...restField}
                          noStyle
                          name={[name, 'label']}
                          rules={[{ message: '请填写显示名称', required: true }]}
                        >
                          <Input placeholder="显示名称" style={{ flex: 1 }} />
                        </Form.Item>
                        <Form.Item {...restField} noStyle name={[name, 'url']}>
                          <Input placeholder="https://..." style={{ flex: 1.5 }} />
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
                      onClick={() => add({ label: '', url: '' })}
                    >
                      {t('admin.settings.helpMenuAdd', '添加菜单项')}
                    </Button>
                  </Flexbox>
                )}
              </Form.List>
            </Form.Item>
          </Card>

          <Space>
            <Button
              disabled={!hasPendingChanges}
              loading={submitting}
              type="primary"
              onClick={handleSave}
            >
              {t('admin.settings.save', '保存设置')}
            </Button>
            {hasPendingChanges && <Text type="secondary">有 {pendingUpdates.length} 项待保存</Text>}
          </Space>
        </Space>
      </Form>

      <Modal
        footer={null}
        open={!!runResult}
        title={t('admin.settings.runResult', '维护结果')}
        onCancel={() => setRunResult(null)}
      >
        <Flexbox gap={8}>
          <div>已删除审计日志：{runResult?.auditLogsDeleted ?? 0}</div>
          <div>审计日志清理时间点：{runResult?.auditCutoff ?? '-'}</div>
          <div>已过期待支付订单：{runResult?.pendingOrdersExpired ?? 0}</div>
          <div>待支付订单过期时间点：{runResult?.pendingOrdersCutoff ?? '-'}</div>
        </Flexbox>
      </Modal>
    </Flexbox>
  );
});

AdminSettingsPage.displayName = 'AdminSettingsPage';

export default AdminSettingsPage;
