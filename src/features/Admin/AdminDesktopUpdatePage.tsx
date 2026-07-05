'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Divider, Form, Input, InputNumber, message, Radio, Space, Switch } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ADMIN_SETTINGS_SWR_KEY } from '@/const/adminCacheKeys';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import {
  DESKTOP_DEFAULT_BUSINESS_SERVER_URL,
  DESKTOP_SETTINGS_SECTIONS,
  DESKTOP_UPDATE_SETTING_KEYS as SETTING_KEYS,
} from './adminDesktopUpdateSettings';

type AdminSettingsData = Awaited<ReturnType<typeof adminCommercialService.getAllSettings>>;

type FormValues = {
  autoCheck: boolean;
  channel: string;
  checkInterval: number;
  currentVersion: string;
  downloadLabel: string;
  downloadUrl: string;
  loginCloudButtonLabel: string;
  loginDescription: string;
  loginFooterText: string;
  loginLogoUrl: string;
  loginTitle: string;
  loginWindowTitle: string;
  ossAccessKeyId: string;
  ossAccessKeySecret: string;
  ossBucket: string;
  ossEndpoint: string;
  ossPath: string;
  releaseNotes: string;
  serverUrl: string;
};

const getInitialValues = (data?: AdminSettingsData): FormValues => ({
  autoCheck: data?.desktopUpdateConfig?.autoCheck ?? true,
  channel: data?.desktopUpdateConfig?.channel || 'stable',
  checkInterval: data?.desktopUpdateConfig?.checkInterval || 60,
  currentVersion: data?.desktopUpdateConfig?.currentVersion || '',
  downloadLabel: data?.desktopDownloadLabel || '',
  downloadUrl: data?.desktopDownloadUrl || '',
  loginCloudButtonLabel: data?.desktopLoginConfig?.cloudButtonLabel || '',
  loginDescription: data?.desktopLoginConfig?.description || '',
  loginFooterText: data?.desktopLoginConfig?.footerText || '',
  loginLogoUrl: data?.desktopLoginConfig?.logoUrl || '',
  loginTitle: data?.desktopLoginConfig?.title || '',
  loginWindowTitle: data?.desktopLoginConfig?.windowTitle || '',
  ossAccessKeyId: data?.desktopOssConfig?.accessKeyId || '',
  ossAccessKeySecret: '',
  ossBucket: data?.desktopOssConfig?.bucket || '',
  ossEndpoint: data?.desktopOssConfig?.endpoint || '',
  ossPath: data?.desktopOssConfig?.path || 'releases',
  releaseNotes: data?.desktopUpdateConfig?.releaseNotes || '',
  serverUrl: data?.desktopUpdateConfig?.serverUrl || '',
});

const AdminDesktopUpdatePage = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useClientDataSWR(ADMIN_SETTINGS_SWR_KEY, () =>
    adminCommercialService.getAllSettings(),
  );
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);

  const initialValues = getInitialValues(data);

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue(getInitialValues(data));
  }, [data, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const updates: { key: string; value: unknown }[] = [];

      const pushTextUpdate = (field: keyof FormValues, key: string) => {
        const value = String(values[field] ?? '').trim();
        if (value !== String(initialValues[field] ?? '')) updates.push({ key, value });
      };

      pushTextUpdate('loginWindowTitle', SETTING_KEYS.desktopLoginWindowTitle);
      pushTextUpdate('loginLogoUrl', SETTING_KEYS.desktopLoginLogoUrl);
      pushTextUpdate('loginTitle', SETTING_KEYS.desktopLoginTitle);
      pushTextUpdate('loginDescription', SETTING_KEYS.desktopLoginDescription);
      pushTextUpdate('loginCloudButtonLabel', SETTING_KEYS.desktopLoginCloudButtonLabel);
      pushTextUpdate('loginFooterText', SETTING_KEYS.desktopLoginFooterText);
      pushTextUpdate('serverUrl', SETTING_KEYS.desktopUpdateServerUrl);

      if (values.channel !== initialValues.channel) {
        updates.push({ key: SETTING_KEYS.desktopUpdateChannel, value: values.channel });
      }
      if (values.autoCheck !== initialValues.autoCheck) {
        updates.push({ key: SETTING_KEYS.desktopUpdateAutoCheck, value: values.autoCheck });
      }
      if (values.checkInterval !== initialValues.checkInterval) {
        updates.push({ key: SETTING_KEYS.desktopUpdateCheckInterval, value: values.checkInterval });
      }

      pushTextUpdate('currentVersion', SETTING_KEYS.desktopUpdateCurrentVersion);
      pushTextUpdate('releaseNotes', SETTING_KEYS.desktopUpdateReleaseNotes);
      pushTextUpdate('downloadUrl', SETTING_KEYS.desktopDownloadUrl);
      pushTextUpdate('downloadLabel', SETTING_KEYS.desktopDownloadLabel);
      pushTextUpdate('ossBucket', SETTING_KEYS.desktopOssBucket);
      pushTextUpdate('ossEndpoint', SETTING_KEYS.desktopOssEndpoint);
      pushTextUpdate('ossAccessKeyId', SETTING_KEYS.desktopOssAccessKeyId);

      if (values.ossAccessKeySecret) {
        updates.push({
          key: SETTING_KEYS.desktopOssAccessKeySecret,
          value: values.ossAccessKeySecret.trim(),
        });
      }

      pushTextUpdate('ossPath', SETTING_KEYS.desktopOssPath);

      if (updates.length === 0) {
        message.info(t('admin.desktopUpdate.noChanges', '没有需要保存的变更'));
        return;
      }

      setSubmitting(true);
      await adminCommercialService.setAppSettingsBatch({ updates });
      message.success(t('admin.desktopUpdate.saveSuccess', '客户端设置已保存'));
      await mutate(ADMIN_SETTINGS_SWR_KEY);
    } catch {
      message.error(t('admin.desktopUpdate.saveFailed', '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 760 }}>
      <Form disabled={isLoading} form={form} initialValues={initialValues} layout="vertical">
        <Divider plain>
          {t('admin.desktopUpdate.loginSection', DESKTOP_SETTINGS_SECTIONS[1].title)}
        </Divider>

        <Alert
          showIcon
          type="info"
          description={t(
            'admin.desktopUpdate.loginSection.description',
            '这些配置会影响桌面客户端登录窗口中的标题栏、登录头像、主标题、副标题、云端登录按钮和底部版权。',
          )}
          message={t('admin.desktopUpdate.loginSection.message', '客户端登录页可在后台自定义')}
        />

        <Form.Item
          extra={t('admin.desktopUpdate.loginWindowTitle.help', '显示在客户端登录窗口顶部标题栏。')}
          label={t('admin.desktopUpdate.loginWindowTitle', '标题栏文字')}
          name="loginWindowTitle"
        >
          <Input placeholder="XUANGUO" />
        </Form.Item>

        <Form.Item
          extra={t('admin.desktopUpdate.loginLogoUrl.help', '支持站内路径或完整图片 URL。留空使用默认品牌 Logo。')}
          label={t('admin.desktopUpdate.loginLogoUrl', '登录头像/Logo 地址')}
          name="loginLogoUrl"
        >
          <Input placeholder="/images/brand/xuanguo.png" />
        </Form.Item>

        <Form.Item
          label={t('admin.desktopUpdate.loginTitle', '登录主标题')}
          name="loginTitle"
        >
          <Input placeholder="登录以实现跨设备同步" />
        </Form.Item>

        <Form.Item
          label={t('admin.desktopUpdate.loginDescription', '登录副标题')}
          name="loginDescription"
        >
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder="登录以在所有设备间同步代理、群组、设置和上下文。"
          />
        </Form.Item>

        <Form.Item
          label={t('admin.desktopUpdate.loginCloudButtonLabel', '云端登录按钮文案')}
          name="loginCloudButtonLabel"
        >
          <Input placeholder="登录 XUANGUO Cloud" />
        </Form.Item>

        <Form.Item
          label={t('admin.desktopUpdate.loginFooterText', '底部版权文案')}
          name="loginFooterText"
        >
          <Input placeholder="© 2026 XUANGUO. All rights reserved." />
        </Form.Item>

        <Divider plain>
          {t('admin.desktopUpdate.businessSection', DESKTOP_SETTINGS_SECTIONS[0].title)}
        </Divider>

        <Alert
          showIcon
          type="info"
          description={t(
            'admin.desktopUpdate.businessConnection.description',
            '桌面客户端的登录、同步、tRPC/API、OIDC 与本地代理请求默认连接到该业务服务地址。此地址由桌面发布流水线注入，后台这里只做展示，避免和更新服务器地址混淆。',
          )}
          message={t(
            'admin.desktopUpdate.businessConnection.message',
            '桌面业务连接由发布包控制',
          )}
        />

        <Form.Item
          label={t('admin.desktopUpdate.businessConnection.url', '业务服务地址')}
          extra={t(
            'admin.desktopUpdate.businessConnection.url.help',
            '如需调整正式客户端默认连接地址，应修改桌面发布流水线的 OFFICIAL_CLOUD_SERVER，而不是修改更新服务器地址。',
          )}
        >
          <Input disabled value={DESKTOP_DEFAULT_BUSINESS_SERVER_URL} />
        </Form.Item>

        <Divider plain>
          {t('admin.desktopUpdate.serverSection', DESKTOP_SETTINGS_SECTIONS[2].title)}
        </Divider>

        <Form.Item
          label={t('admin.desktopUpdate.serverUrl', '更新服务器地址（URL）')}
          name="serverUrl"
          extra={t(
            'admin.desktopUpdate.serverUrl.help',
            '更新清单和安装包所在的 S3/CDN 基础地址，例如 https://releases.example.com。每个渠道会解析为 {url}/{channel}/。',
          )}
        >
          <Input placeholder="https://releases.example.com" />
        </Form.Item>

        <Form.Item
          label={t('admin.desktopUpdate.channel', '默认更新渠道')}
          name="channel"
          extra={t(
            'admin.desktopUpdate.channel.help',
            'stable 表示正式发布，canary 表示预发布构建。',
          )}
        >
          <Radio.Group>
            <Radio value="stable">正式版（Stable）</Radio>
            <Radio value="canary">预发布版（Canary）</Radio>
          </Radio.Group>
        </Form.Item>

        <Divider plain>
          {t('admin.desktopUpdate.checkSection', DESKTOP_SETTINGS_SECTIONS[3].title)}
        </Divider>

        <Form.Item
          label={t('admin.desktopUpdate.autoCheck', '自动检查更新')}
          name="autoCheck"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label={t('admin.desktopUpdate.checkInterval', '检查间隔（分钟）')}
          name="checkInterval"
          extra={t(
            'admin.desktopUpdate.checkInterval.help',
            '桌面端检查更新的频率，范围 1-1440 分钟。',
          )}
        >
          <InputNumber max={1440} min={1} style={{ width: '100%' }} />
        </Form.Item>

        <Divider plain>
          {t('admin.desktopUpdate.versionSection', DESKTOP_SETTINGS_SECTIONS[4].title)}
        </Divider>

        <Form.Item
          label={t('admin.desktopUpdate.currentVersion', '当前版本')}
          name="currentVersion"
          extra={t(
            'admin.desktopUpdate.currentVersion.help',
            '已发布到更新服务器的最新版本号，仅用于展示。',
          )}
        >
          <Input placeholder="1.0.0" />
        </Form.Item>

        <Form.Item
          label={t('admin.desktopUpdate.releaseNotes', '版本说明')}
          name="releaseNotes"
          extra={t(
            'admin.desktopUpdate.releaseNotes.help',
            '有可用更新时展示给用户的版本说明，支持 Markdown。',
          )}
        >
          <Input.TextArea placeholder={'## 更新内容\n- 新功能 A\n- 修复问题 B'} rows={6} />
        </Form.Item>

        <Divider plain>
          {t('admin.desktopUpdate.downloadSection', DESKTOP_SETTINGS_SECTIONS[5].title)}
        </Divider>

        <Form.Item
          label={t('admin.desktopUpdate.downloadUrl', '桌面客户端下载地址（URL）')}
          name="downloadUrl"
          extra={t(
            'admin.desktopUpdate.downloadUrl.help',
            '用于覆盖用户面板中的桌面客户端下载链接。留空则使用内置地址。',
          )}
        >
          <Input placeholder="https://example.com/download" />
        </Form.Item>

        <Form.Item
          extra={t('admin.desktopUpdate.downloadLabel.help', '显示在客户端下载入口的按钮文案。')}
          label={t('admin.desktopUpdate.downloadLabel', '下载按钮文案')}
          name="downloadLabel"
        >
          <Input placeholder="下载桌面端应用" />
        </Form.Item>

        <Divider plain>
          {t('admin.desktopUpdate.ossSection', DESKTOP_SETTINGS_SECTIONS[6].title)}
        </Divider>

        <Form.Item
          label={t('admin.desktopUpdate.ossBucket', 'OSS 存储桶（Bucket）')}
          name="ossBucket"
          extra={t(
            'admin.desktopUpdate.ossBucket.help',
            'OSS Bucket 名称，不需要填写 oss:// 前缀，例如 comhubup。',
          )}
        >
          <Input placeholder="comhubup" />
        </Form.Item>

        <Form.Item
          label={t('admin.desktopUpdate.ossEndpoint', 'OSS 访问端点（Endpoint）')}
          name="ossEndpoint"
          extra={t(
            'admin.desktopUpdate.ossEndpoint.help',
            'OSS Endpoint 地址，例如 oss-cn-beijing.aliyuncs.com。',
          )}
        >
          <Input placeholder="oss-cn-beijing.aliyuncs.com" />
        </Form.Item>

        <Form.Item
          label={t('admin.desktopUpdate.ossAccessKeyId', '访问密钥 ID（AccessKey ID）')}
          name="ossAccessKeyId"
        >
          <Input placeholder="LTAI5t..." />
        </Form.Item>

        <Form.Item
          label={t('admin.desktopUpdate.ossAccessKeySecret', '访问密钥 Secret（AccessKey Secret）')}
          name="ossAccessKeySecret"
          extra={
            data?.desktopOssConfig?.accessKeySecretMasked
              ? `${t('admin.desktopUpdate.current', '当前值')}: ${data.desktopOssConfig.accessKeySecretMasked}`
              : t('admin.desktopUpdate.notSet', '未配置')
          }
        >
          <Input.Password placeholder={t('admin.desktopUpdate.leaveBlank', '留空则保持当前值')} />
        </Form.Item>

        <Form.Item
          label={t('admin.desktopUpdate.ossPath', 'OSS 路径前缀')}
          name="ossPath"
          extra={t(
            'admin.desktopUpdate.ossPath.help',
            '存储桶内的路径前缀，例如 releases。最终地址格式为 https://{bucket}.{endpoint}/{path}/{channel}/latest.yml。',
          )}
        >
          <Input placeholder="releases" />
        </Form.Item>

        <Space>
          <Button loading={submitting} type="primary" onClick={handleSave}>
            {t('admin.desktopUpdate.save', '保存')}
          </Button>
        </Space>
      </Form>
    </Flexbox>
  );
});

AdminDesktopUpdatePage.displayName = 'AdminDesktopUpdatePage';

export default AdminDesktopUpdatePage;
