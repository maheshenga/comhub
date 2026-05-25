'use client';

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Flexbox } from '@lobehub/ui';
import {
  Alert,
  AutoComplete,
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
} from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
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

const memoryTriggerModeOptions = [
  {
    label: '自动选择',
    value: 'auto',
  },
  {
    label: '直接执行（推荐单机 Node 部署）',
    value: 'direct',
  },
  {
    label: 'QStash 工作流优先（缺失 Token 时回退直接执行）',
    value: 'workflow',
  },
];

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
  const [testingS3, setTestingS3] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{
    auditCutoff?: string;
    auditLogsDeleted?: number;
    freeSnapshotsCreated?: number;
    notificationRetentionCutoff?: string;
    notificationsDeleted?: number;
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
      form.setFieldValue('storageS3SecretAccessKey', '');
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

  const handleTestS3Storage = async () => {
    setTestingS3(true);
    try {
      const result = await adminCommercialService.testS3Storage();
      const checkSummary = result.checks
        ? 'Bucket、CORS、预签名上传、读取、删除均通过'
        : '连接正常';
      message.success(
        t(
          'admin.settings.storageS3.testSuccess',
          `S3 测试通过：${result.bucket}（${result.filePath}），${checkSummary}`,
        ),
      );
    } catch (error) {
      message.error(
        `${t('admin.settings.storageS3.testFailed', 'S3 连接失败')}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setTestingS3(false);
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
              key: 'storage',
              label: '文件存储',
              children: (
                <Card title={t('admin.settings.storageS3Section', '文件存储（S3）')}>
                  <Alert
                    showIcon
                    style={{ marginBottom: 16 }}
                    type="info"
                    message={t(
                      'admin.settings.storageS3.help',
                      '这里配置用户上传文件、头像、图片生成、视频生成等内容的对象存储。后台配置优先于环境变量；留空字段会继续使用服务器环境变量作为兜底。修改后后续请求立即使用新配置，不需要重新构建；上传目录前缀在浏览器刷新后生效。',
                    )}
                  />
                  <Space style={{ marginBottom: 16 }}>
                    <Button loading={testingS3} onClick={handleTestS3Storage}>
                      {t('admin.settings.storageS3.test', '测试 S3 连接')}
                    </Button>
                    <Text type="secondary">
                      {t(
                        'admin.settings.storageS3.test.help',
                        '测试会校验当前已保存配置能否访问 Bucket，不会写入文件。',
                      )}
                    </Text>
                  </Space>
                  <Form.Item
                    label={t('admin.settings.storageS3AccessKeyId', 'Access Key ID')}
                    name="storageS3AccessKeyId"
                  >
                    <Input placeholder="S3_ACCESS_KEY_ID" />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.storageS3SecretAccessKey', 'Secret Access Key')}
                    name="storageS3SecretAccessKey"
                    extra={
                      data?.storageS3SecretAccessKeyConfigured
                        ? `${t('admin.settings.current', '当前值')}: ${
                            data.storageS3SecretAccessKeyMasked || '已配置'
                          }`
                        : t('admin.settings.notSet', '未配置')
                    }
                  >
                    <Input.Password
                      autoComplete="new-password"
                      placeholder={t('admin.settings.leaveBlank', '留空则保持当前值')}
                    />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.storageS3Endpoint', 'Endpoint 地址')}
                    name="storageS3Endpoint"
                    extra={t(
                      'admin.settings.storageS3Endpoint.help',
                      '填写 S3 兼容服务的 API 地址，例如 https://s3.amazonaws.com、https://oss-cn-hangzhou.aliyuncs.com 或 MinIO/RustFS 地址。',
                    )}
                  >
                    <Input placeholder="https://s3.example.com" />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.storageS3Bucket', 'Bucket 名称')}
                    name="storageS3Bucket"
                  >
                    <Input placeholder="lobe" />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.storageS3Region', 'Region 区域')}
                    name="storageS3Region"
                    extra={t(
                      'admin.settings.storageS3Region.help',
                      'AWS S3 通常需要区域；MinIO/RustFS 可以留空或使用 us-east-1。',
                    )}
                  >
                    <Input placeholder="us-east-1" />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.storageS3PublicDomain', '公开访问域名 / CDN')}
                    name="storageS3PublicDomain"
                    extra={t(
                      'admin.settings.storageS3PublicDomain.help',
                      '当开启公开读 ACL 时用于拼接文件访问 URL；未配置或关闭公开读时系统会返回短期预签名 URL。',
                    )}
                  >
                    <Input placeholder="https://cdn.example.com" />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.storageS3FilePath', '上传目录前缀')}
                    name="storageS3FilePath"
                    extra={t(
                      'admin.settings.storageS3FilePath.help',
                      '用于生成对象 Key，例如 files/490000/mock.png。建议使用 files、uploads 或按业务命名的短前缀，不要以 / 开头。',
                    )}
                  >
                    <Input placeholder="files" />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.storageS3EnablePathStyle', '启用 Path-style 路径')}
                    name="storageS3EnablePathStyle"
                    valuePropName="checked"
                    extra={t(
                      'admin.settings.storageS3EnablePathStyle.help',
                      'MinIO、RustFS 等自建 S3 通常需要开启；AWS/R2/OSS 多数场景可以关闭。',
                    )}
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.storageS3SetAcl', '上传时设置 public-read ACL')}
                    name="storageS3SetAcl"
                    valuePropName="checked"
                    extra={t(
                      'admin.settings.storageS3SetAcl.help',
                      '只有对象存储允许 ACL 且需要直接公开访问时开启；否则建议关闭，系统会使用预签名 URL。',
                    )}
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.storageS3PreviewUrlExpireIn', '预览 URL 有效期（秒）')}
                    name="storageS3PreviewUrlExpireIn"
                    extra={t(
                      'admin.settings.storageS3PreviewUrlExpireIn.help',
                      '关闭公开读或未配置 CDN 时生效。建议 1800-7200 秒；过短会导致模型读取图片时 URL 过期。',
                    )}
                  >
                    <InputNumber max={604_800} min={60} style={{ width: '100%' }} />
                  </Form.Item>
                </Card>
              ),
            },
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
                    label={t('admin.settings.homeMessengerEnabled', '启用首页聊天平台入口')}
                    name="homeMessengerEnabled"
                    valuePropName="checked"
                    extra={t(
                      'admin.settings.homeMessengerEnabled.help',
                      '关闭后首页聊天框下方不会再随机显示聊天平台入口；/settings/messenger 功能页仍保留。',
                    )}
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.homeMessengerBannerTitle', '首页聊天平台文案')}
                    name="homeMessengerBannerTitle"
                    extra={t(
                      'admin.settings.homeMessengerBannerTitle.help',
                      '控制首页聊天框下方“聊天平台”入口文字，留空时使用系统默认文案。',
                    )}
                  >
                    <Input placeholder="在你喜爱的聊天应用中，与 {{brandName}} 畅聊" />
                  </Form.Item>
                  <Form.Item
                    label={t('admin.settings.communityForkAndChatLabel', '社区派生按钮文字')}
                    name="communityForkAndChatLabel"
                    extra={t(
                      'admin.settings.communityForkAndChatLabel.help',
                      '控制社区详情页派生按钮文字，留空时使用系统默认文案。',
                    )}
                  >
                    <Input placeholder="派生并聊天" />
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
                    label={t('admin.settings.profileInterestAreas', '用户兴趣领域')}
                    extra={t(
                      'admin.settings.profileInterestAreas.help',
                      '用于注册引导和个人资料页的“兴趣领域”。留空时使用系统默认标签；配置后按这里的列表展示。',
                    )}
                  >
                    <Form.List name="profileInterestAreas">
                      {(fields, { add, remove }) => (
                        <Flexbox gap={8}>
                          {fields.map(({ key, name, ...restField }) => (
                            <Flexbox horizontal align="center" gap={8} key={key}>
                              <Form.Item {...restField} noStyle name={[name, 'key']}>
                                <Input
                                  placeholder="唯一标识，可留空自动使用名称"
                                  style={{ flex: 1 }}
                                />
                              </Form.Item>
                              <Form.Item
                                {...restField}
                                noStyle
                                name={[name, 'label']}
                                rules={[{ message: '请填写显示名称', required: true }]}
                              >
                                <Input placeholder="显示名称，例如 AI 绘画" style={{ flex: 1.4 }} />
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
                            onClick={() => add({ key: '', label: '' })}
                          >
                            {t('admin.settings.profileInterestAreas.add', '添加兴趣领域')}
                          </Button>
                        </Flexbox>
                      )}
                    </Form.List>
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
                      filterOption={(inputValue: string, option?: { value?: string }) =>
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
                      filterOption={(
                        inputValue: string,
                        option?: { label?: unknown; value?: string },
                      ) =>
                        String(option?.label ?? option?.value ?? '')
                          .toLowerCase()
                          .includes(inputValue.toLowerCase())
                      }
                      onSelect={(value: string) => {
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
                      filterOption={(
                        inputValue: string,
                        option?: { label?: unknown; value?: string },
                      ) =>
                        String(option?.label ?? option?.value ?? '')
                          .toLowerCase()
                          .includes(inputValue.toLowerCase())
                      }
                      onSelect={(value: string) => {
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
                      filterOption={(
                        inputValue: string,
                        option?: { label?: unknown; value?: string },
                      ) =>
                        String(option?.label ?? option?.value ?? '')
                          .toLowerCase()
                          .includes(inputValue.toLowerCase())
                      }
                      onSelect={(value: string) => {
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

                  <Card title={t('admin.settings.memorySection', '记忆系统')}>
                    <Alert
                      showIcon
                      style={{ marginBottom: 16 }}
                      type="info"
                      message={t(
                        'admin.settings.memoryTriggerMode.reason',
                        '记忆分析会扫描用户聊天主题并调用模型提取长期记忆，任务可能较慢。当前单机 Node 部署建议使用“直接执行”，不依赖 Upstash/QStash；如果后续改为多实例或云函数部署，再切换到 QStash 工作流。',
                      )}
                    />
                    <Form.Item
                      label={t('admin.settings.memoryTriggerMode', '记忆分析执行模式')}
                      name="memoryUserMemoryTriggerMode"
                      extra={t(
                        'admin.settings.memoryTriggerMode.help',
                        '自动选择：检测到 QSTASH_TOKEN 时优先使用 QStash 工作流，否则直接执行。直接执行：在当前 Node 服务内异步处理，简单稳定，但服务重启会中断正在执行的任务。QStash 工作流优先：适合多实例、云函数和可重试队列场景；如果缺少 QSTASH_TOKEN，系统会回退为直接执行。环境变量 MEMORY_USER_MEMORY_TRIGGER_MODE 可作为运维级覆盖。',
                      )}
                    >
                      <Select options={memoryTriggerModeOptions} />
                    </Form.Item>
                    <Text type="secondary">
                      QSTASH_TOKEN：
                      {data?.qstashTokenConfigured ? '已配置，可使用工作流模式' : '未配置'}
                      ；环境变量 MEMORY_USER_MEMORY_TRIGGER_MODE：
                      {data?.memoryUserMemoryTriggerModeEnv || '未设置'}
                    </Text>
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
          <div>已删除归档通知：{runResult?.notificationsDeleted ?? 0}</div>
          <div>归档通知清理时间点：{runResult?.notificationRetentionCutoff ?? '-'}</div>
          <div>已过期订阅快照：{runResult?.subscriptionSnapshotsExpired ?? 0}</div>
          <div>已补充免费套餐：{runResult?.freeSnapshotsCreated ?? 0}</div>
        </Flexbox>
      </Modal>
    </Flexbox>
  );
});

AdminSettingsPage.displayName = 'AdminSettingsPage';

export default AdminSettingsPage;
