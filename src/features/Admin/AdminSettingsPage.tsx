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
  Switch,
  Tabs,
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
  SETTING_KEYS,
} from '@/features/Admin/adminSettingsForm';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text, Title } = Typography;

const providerOptions = ['newapi', 'openai', 'anthropic', 'google', 'deepseek', 'ollama'].map(
  (value) => ({ label: value, value }),
);

const aboutLinkGroups = [
  { key: 'contact', title: '联系入口', titleKey: 'admin.settings.aboutLinks.contact' },
  { key: 'information', title: '社区与资讯', titleKey: 'admin.settings.aboutLinks.information' },
  { key: 'legal', title: '法律声明', titleKey: 'admin.settings.aboutLinks.legal' },
] as const;

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
    freeSnapshotsCreated?: number;
    pendingOrdersCutoff?: string;
    pendingOrdersExpired?: number;
    subscriptionSnapshotsExpired?: number;
  } | null>(null);

  const watchedValues = Form.useWatch([], form) as Partial<AdminSettingsFormValues> | undefined;
  const initialValues = useMemo(() => buildFormValues(data), [data]);
  const pendingUpdates = buildSettingUpdates(watchedValues ?? initialValues, initialValues);
  const hasPendingChanges = pendingUpdates.length > 0;
  const defaultModelOptions = buildModelOptions({ ...data, modelType: 'chat' });
  const defaultImageModelOptions = buildModelOptions({ ...data, modelType: 'image' });
  const defaultVideoModelOptions = buildModelOptions({ ...data, modelType: 'video' });
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
      if (
        updates.some(
          (update) =>
            update.key === SETTING_KEYS.defaultAgentModel ||
            update.key === SETTING_KEYS.defaultAgentProvider,
        )
      ) {
        await adminCommercialService.validateDefaultAgentSettings({
          model: values.defaultAgentModel,
          provider: values.defaultAgentProvider,
        });
      }
      if (
        updates.some(
          (update) =>
            update.key === SETTING_KEYS.defaultImageModel ||
            update.key === SETTING_KEYS.defaultImageProvider,
        )
      ) {
        await adminCommercialService.validateDefaultAgentSettings({
          model: values.defaultImageModel,
          modelType: 'image',
          provider: values.defaultImageProvider,
        });
      }
      if (
        updates.some(
          (update) =>
            update.key === SETTING_KEYS.defaultVideoModel ||
            update.key === SETTING_KEYS.defaultVideoProvider,
        )
      ) {
        await adminCommercialService.validateDefaultAgentSettings({
          model: values.defaultVideoModel,
          modelType: 'video',
          provider: values.defaultVideoProvider,
        });
      }

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
              '设置已保存，默认助手配置已刷新到当前会话',
            )
          : t('admin.settings.saveSuccess', '设置已保存'),
      );
    } catch (error: any) {
      const errorMessage =
        error?.message === 'DEFAULT_MODEL_NOT_ENABLED'
          ? t(
              'admin.settings.defaultModel.notEnabled',
              '默认模型未在已启用模型目录中，请先在服务商实例中启用该模型。',
            )
          : error?.message === 'DEFAULT_MODEL_TYPE_MISMATCH'
            ? t(
                'admin.settings.defaultModel.typeMismatch',
                '默认模型类型不匹配，请确认聊天、图像、视频分别选择对应类型的模型。',
              )
            : error?.message === 'DEFAULT_MODEL_DENIED_BY_FREE_PLAN'
              ? t(
                  'admin.settings.defaultModel.deniedByFreePlan',
                  '默认模型未被免费套餐允许，新注册用户将无法使用该模型。请调整免费套餐模型规则。',
                )
              : t('admin.settings.saveFailed', '保存失败，请检查表单内容');
      message.error(errorMessage);
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

  const renderAboutLinkGroup = (group: (typeof aboutLinkGroups)[number]) => (
    <Form.List key={group.key} name={['aboutLinks', group.key]}>
      {(fields) => (
        <Flexbox gap={8}>
          <Text strong>{t(group.titleKey, group.title)}</Text>
          {fields.map(({ key, name, ...restField }) => (
            <Flexbox horizontal align="center" gap={8} key={key}>
              <Form.Item {...restField} hidden name={[name, 'id']}>
                <Input />
              </Form.Item>
              <Form.Item
                {...restField}
                noStyle
                name={[name, 'label']}
                rules={[
                  {
                    message: t('admin.settings.aboutLinks.labelRequired', '请填写名称'),
                    required: true,
                  },
                ]}
              >
                <Input
                  placeholder={t('admin.settings.aboutLinks.label', '名称')}
                  style={{ flex: 1 }}
                />
              </Form.Item>
              <Form.Item
                {...restField}
                noStyle
                name={[name, 'url']}
                rules={[
                  {
                    message: t('admin.settings.aboutLinks.urlRequired', '请填写链接'),
                    required: true,
                  },
                ]}
              >
                <Input placeholder="https://..." style={{ flex: 1.6 }} />
              </Form.Item>
            </Flexbox>
          ))}
        </Flexbox>
      )}
    </Form.List>
  );

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 980 }}>
      <Flexbox gap={4}>
        <Title level={3} style={{ margin: 0 }}>
          {t('admin.settings.title', '站点与 API 设置')}
        </Title>
        <Text type="secondary">{t('admin.settings.subtitle', SETTINGS_SUBTITLE)}</Text>
      </Flexbox>

      <Form disabled={isLoading} form={form} layout="vertical">
        <Tabs
          items={[
            {
              key: 'brand',
              label: '品牌与登录',
              children: (
                <Card>
                  <Form.Item
                    label={t('admin.settings.brandName', '品牌名称')}
                    name="brandName"
                    extra={t(
                      'admin.settings.brandName.help',
                      '用于页面标题、导航、关于页面和站内品牌展示。',
                    )}
                  >
                    <Input placeholder="玄果 AI" />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.brandLoadingText', '加载页文案')}
                    name="brandLoadingText"
                    extra={t(
                      'admin.settings.brandSlogan.help',
                      '用于页面中央加载状态。首屏静态加载和 React 接管后的加载都会显示这段文案。',
                    )}
                  >
                    <Input
                      placeholder={t(
                        'admin.settings.brandSlogan.placeholder',
                        '与 Agent 团队一起无限进步',
                      )}
                    />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.brandAuthTitle', '登录页主文案')}
                    name="brandAuthTitle"
                    extra={t(
                      'admin.settings.brandAuthTitle.help',
                      '显示在登录和注册表单上方，例如 Agent teammates that grow with you。',
                    )}
                  >
                    <Input placeholder="Agent teammates that grow with you" />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.brandCopyrightText', '登录页底部版权')}
                    name="brandCopyrightText"
                    extra={t(
                      'admin.settings.brandCopyrightText.help',
                      '显示在登录页底部，留空时使用默认版权文案。',
                    )}
                  >
                    <Input placeholder="© 2026 玄果 AI. All rights reserved." />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.brandLogoUrl', 'Logo 地址（URL）')}
                    name="brandLogoUrl"
                    extra={t(
                      'admin.settings.brandLogoUrl.help',
                      '用于登录页右上角、站内品牌 Logo 和图标展示。',
                    )}
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
                    label={t('admin.settings.brandPrimaryColor', '主题主色')}
                    name="brandPrimaryColor"
                    extra={t(
                      'admin.settings.brandPrimary.help',
                      '填写十六进制颜色值，例如 #1677ff。',
                    )}
                  >
                    <Input placeholder="#1677ff" />
                  </Form.Item>
                </Card>
              ),
            },
            {
              key: 'assistant',
              label: '默认助手',
              children: (
                <Card>
                  <Alert
                    showIcon
                    message={t('admin.settings.defaultModelNotice', SETTINGS_DEFAULT_MODEL_NOTICE)}
                    style={{ marginBottom: 16 }}
                    type="info"
                  />
                  <Form.Item
                    label={t('admin.settings.defaultAgentName', '助手名称')}
                    name="defaultAgentName"
                    extra={t(
                      'admin.settings.defaultAgentName.help',
                      '用于新用户默认会话、欢迎页和侧边栏中的助手名称。',
                    )}
                  >
                    <Input placeholder="玄果助手" />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.defaultAgentAvatar', '助手头像代码')}
                    name="defaultAgentAvatar"
                    extra={t(
                      'admin.settings.defaultAgentAvatar.help',
                      '支持图片 URL、站内路径或 emoji。留空时使用默认头像。',
                    )}
                  >
                    <Input placeholder="/images/brand/qingyou-ai-logo.png" />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.defaultSkillName', '默认技能名称')}
                    name="defaultSkillName"
                    extra={t(
                      'admin.settings.defaultSkillName.help',
                      '用于配置内置默认技能的显示名称；留空时使用品牌名称。',
                    )}
                  >
                    <Input
                      placeholder={t('admin.settings.defaultSkillName.placeholder', '玄果技能')}
                    />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.defaultProvider', '默认供应商（Provider）')}
                    name="defaultAgentProvider"
                    extra={t(
                      'admin.settings.defaultProvider.help',
                      '使用服务商网关时填写对应供应商标识，例如 openai、deepseek、aliyun 或自定义兼容服务商。该值会写入后台默认助手配置。',
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
                        placeholder="选择或输入服务商标识"
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
              ),
            },
            {
              key: 'models',
              label: '默认模型',
              children: (
                <Card>
                  <Form.Item
                    label={t('admin.settings.defaultImageProvider', '默认图像供应商（Provider）')}
                    name="defaultImageProvider"
                    extra={t(
                      'admin.settings.defaultImageProvider.help',
                      '用于 image 页面初始化。请填写图像模型所属服务商标识，例如 openai、google、aliyun 或自定义兼容服务商。',
                    )}
                  >
                    <AutoComplete options={providerOptions}>
                      <Input
                        allowClear
                        placeholder="选择或输入服务商标识"
                        onBlur={() =>
                          form.setFieldValue(
                            'defaultImageProvider',
                            normalizeText(form.getFieldValue('defaultImageProvider')),
                          )
                        }
                      />
                    </AutoComplete>
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.defaultImageModel', '默认图像模型（Model）')}
                    name="defaultImageModel"
                    extra={t(
                      'admin.settings.defaultImageModel.help',
                      '只能选择已启用的图像模型；免费套餐必须允许该模型。',
                    )}
                  >
                    <AutoComplete
                      options={defaultImageModelOptions}
                      filterOption={(inputValue, option) =>
                        String(option?.label ?? option?.value ?? '')
                          .toLowerCase()
                          .includes(inputValue.toLowerCase())
                      }
                      onSelect={(value) => {
                        const selected = defaultImageModelOptions.find(
                          (item) => item.value === value,
                        );
                        if (!selected) return;

                        form.setFieldValue('defaultImageProvider', selected.provider);
                        form.setFieldValue('defaultImageModel', selected.model);
                      }}
                    >
                      <Input
                        allowClear
                        placeholder="flux-pro"
                        onBlur={() =>
                          form.setFieldValue(
                            'defaultImageModel',
                            normalizeText(form.getFieldValue('defaultImageModel')),
                          )
                        }
                      />
                    </AutoComplete>
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.defaultVideoProvider', '默认视频供应商（Provider）')}
                    name="defaultVideoProvider"
                    extra={t(
                      'admin.settings.defaultVideoProvider.help',
                      '用于 video 页面初始化。请填写视频模型所属服务商标识，例如 google、aliyun 或自定义兼容服务商。',
                    )}
                  >
                    <AutoComplete options={providerOptions}>
                      <Input
                        allowClear
                        placeholder="选择或输入服务商标识"
                        onBlur={() =>
                          form.setFieldValue(
                            'defaultVideoProvider',
                            normalizeText(form.getFieldValue('defaultVideoProvider')),
                          )
                        }
                      />
                    </AutoComplete>
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.defaultVideoModel', '默认视频模型（Model）')}
                    name="defaultVideoModel"
                    extra={t(
                      'admin.settings.defaultVideoModel.help',
                      '只能选择已启用的视频模型；免费套餐必须允许该模型。',
                    )}
                  >
                    <AutoComplete
                      options={defaultVideoModelOptions}
                      filterOption={(inputValue, option) =>
                        String(option?.label ?? option?.value ?? '')
                          .toLowerCase()
                          .includes(inputValue.toLowerCase())
                      }
                      onSelect={(value) => {
                        const selected = defaultVideoModelOptions.find(
                          (item) => item.value === value,
                        );
                        if (!selected) return;

                        form.setFieldValue('defaultVideoProvider', selected.provider);
                        form.setFieldValue('defaultVideoModel', selected.model);
                      }}
                    >
                      <Input
                        allowClear
                        placeholder="sora-2"
                        onBlur={() =>
                          form.setFieldValue(
                            'defaultVideoModel',
                            normalizeText(form.getFieldValue('defaultVideoModel')),
                          )
                        }
                      />
                    </AutoComplete>
                  </Form.Item>
                </Card>
              ),
            },
            {
              key: 'links',
              label: '关于与帮助',
              children: (
                <Card>
                  <Flexbox gap={16}>
                    <Text type="secondary">
                      {t(
                        'admin.settings.aboutLinks.help',
                        '用于 settings/about 页面。名称和链接都会按这里的配置显示；未填写时使用系统默认值。',
                      )}
                    </Text>
                    {aboutLinkGroups.map(renderAboutLinkGroup)}
                    <Form.Item
                      label={t('admin.settings.helpMenuItems', '帮助菜单')}
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
                  </Flexbox>
                </Card>
              ),
            },
            {
              key: 'client',
              label: '客户端与维护',
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Card title={t('admin.settings.growthSection', '增长与推荐')}>
                    <Form.Item
                      label={t('admin.settings.referralReward', '推荐奖励积分')}
                      name="referralRewardCredits"
                    >
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Card>

                  <Card title={t('admin.settings.paymentSection', '支付网关状态')}>
                    <Alert
                      showIcon
                      type={paymentGatewayStatus?.configured ? 'success' : 'warning'}
                      message={
                        paymentGatewayStatus?.message ||
                        '支付网关尚未接入，用户自助支付暂不可用。当前可在后台手动结算订单。'
                      }
                    />
                  </Card>

                  <Card title={t('admin.settings.billingSection', '计费基础')}>
                    <Form.Item
                      label={t('admin.settings.pricingMultiplier', '全局积分倍率')}
                      name="pricingMultiplier"
                      extra={t(
                        'admin.settings.pricingMultiplier.help',
                        '作用于图像、视频等按积分预估扣费的全局倍率；模型级倍率仍在“模型与计费矩阵”维护。',
                      )}
                    >
                      <InputNumber min={0} precision={4} step={0.1} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                      label={t('admin.settings.ordersEnabled', '启用订单管理')}
                      name="ordersEnabled"
                      valuePropName="checked"
                      extra={t(
                        'admin.settings.ordersEnabled.help',
                        '关闭后可隐藏或停用用户自助订单链路，后台仍可查看历史订单。',
                      )}
                    >
                      <Switch />
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
                      <Input.Password
                        placeholder={t('admin.settings.leaveBlank', '留空则保持当前值')}
                      />
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
                      label={t('admin.settings.desktopDownloadUrl', '桌面客户端下载地址（URL）')}
                      name="desktopDownloadUrl"
                      extra={t(
                        'admin.settings.desktopDownloadUrl.help',
                        '用于覆盖用户面板中的桌面客户端下载链接。留空则使用内置地址。',
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
                </Space>
              ),
            },
          ]}
        />

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
          <div>已过期订阅快照：{runResult?.subscriptionSnapshotsExpired ?? 0}</div>
          <div>已补充免费套餐：{runResult?.freeSnapshotsCreated ?? 0}</div>
        </Flexbox>
      </Modal>
    </Flexbox>
  );
});

AdminSettingsPage.displayName = 'AdminSettingsPage';

export default AdminSettingsPage;
