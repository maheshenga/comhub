'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Divider, Form, Input, InputNumber, message, Radio, Space, Switch } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ADMIN_SETTINGS_SWR_KEY } from '@/const/adminCacheKeys';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const SETTING_KEYS = {
  desktopOssAccessKeyId: 'desktop.oss.accessKeyId',
  desktopOssAccessKeySecret: 'desktop.oss.accessKeySecret',
  desktopOssBucket: 'desktop.oss.bucket',
  desktopOssEndpoint: 'desktop.oss.endpoint',
  desktopOssPath: 'desktop.oss.path',
  desktopUpdateAutoCheck: 'desktop.update.autoCheck',
  desktopUpdateChannel: 'desktop.update.channel',
  desktopUpdateCheckInterval: 'desktop.update.checkInterval',
  desktopUpdateCurrentVersion: 'desktop.update.currentVersion',
  desktopUpdateReleaseNotes: 'desktop.update.releaseNotes',
  desktopUpdateServerUrl: 'desktop.update.serverUrl',
} as const;

type FormValues = {
  autoCheck: boolean;
  channel: string;
  checkInterval: number;
  currentVersion: string;
  ossAccessKeyId: string;
  ossAccessKeySecret: string;
  ossBucket: string;
  ossEndpoint: string;
  ossPath: string;
  releaseNotes: string;
  serverUrl: string;
};

const AdminDesktopUpdatePage = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useClientDataSWR(ADMIN_SETTINGS_SWR_KEY, () =>
    adminCommercialService.getAllSettings(),
  );
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);

  const initialValues: FormValues = {
    autoCheck: data?.desktopUpdateConfig?.autoCheck ?? true,
    channel: data?.desktopUpdateConfig?.channel || 'stable',
    checkInterval: data?.desktopUpdateConfig?.checkInterval || 60,
    currentVersion: data?.desktopUpdateConfig?.currentVersion || '',
    ossAccessKeyId: data?.desktopOssConfig?.accessKeyId || '',
    ossAccessKeySecret: '',
    ossBucket: data?.desktopOssConfig?.bucket || '',
    ossEndpoint: data?.desktopOssConfig?.endpoint || '',
    ossPath: data?.desktopOssConfig?.path || 'releases',
    releaseNotes: data?.desktopUpdateConfig?.releaseNotes || '',
    serverUrl: data?.desktopUpdateConfig?.serverUrl || '',
  };

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue({
      autoCheck: data.desktopUpdateConfig?.autoCheck ?? true,
      channel: data.desktopUpdateConfig?.channel || 'stable',
      checkInterval: data.desktopUpdateConfig?.checkInterval || 60,
      currentVersion: data.desktopUpdateConfig?.currentVersion || '',
      ossAccessKeyId: data.desktopOssConfig?.accessKeyId || '',
      ossAccessKeySecret: '',
      ossBucket: data.desktopOssConfig?.bucket || '',
      ossEndpoint: data.desktopOssConfig?.endpoint || '',
      ossPath: data.desktopOssConfig?.path || 'releases',
      releaseNotes: data.desktopUpdateConfig?.releaseNotes || '',
      serverUrl: data.desktopUpdateConfig?.serverUrl || '',
    });
  }, [data, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const updates: { key: string; value: unknown }[] = [];

      if (values.serverUrl !== initialValues.serverUrl) {
        updates.push({ key: SETTING_KEYS.desktopUpdateServerUrl, value: values.serverUrl.trim() });
      }
      if (values.channel !== initialValues.channel) {
        updates.push({ key: SETTING_KEYS.desktopUpdateChannel, value: values.channel });
      }
      if (values.autoCheck !== initialValues.autoCheck) {
        updates.push({ key: SETTING_KEYS.desktopUpdateAutoCheck, value: values.autoCheck });
      }
      if (values.checkInterval !== initialValues.checkInterval) {
        updates.push({ key: SETTING_KEYS.desktopUpdateCheckInterval, value: values.checkInterval });
      }
      if (values.currentVersion !== initialValues.currentVersion) {
        updates.push({
          key: SETTING_KEYS.desktopUpdateCurrentVersion,
          value: values.currentVersion.trim(),
        });
      }
      if (values.releaseNotes !== initialValues.releaseNotes) {
        updates.push({
          key: SETTING_KEYS.desktopUpdateReleaseNotes,
          value: values.releaseNotes.trim(),
        });
      }
      if (values.ossBucket !== initialValues.ossBucket) {
        updates.push({ key: SETTING_KEYS.desktopOssBucket, value: values.ossBucket.trim() });
      }
      if (values.ossEndpoint !== initialValues.ossEndpoint) {
        updates.push({ key: SETTING_KEYS.desktopOssEndpoint, value: values.ossEndpoint.trim() });
      }
      if (values.ossAccessKeyId !== initialValues.ossAccessKeyId) {
        updates.push({
          key: SETTING_KEYS.desktopOssAccessKeyId,
          value: values.ossAccessKeyId.trim(),
        });
      }
      if (values.ossAccessKeySecret) {
        updates.push({
          key: SETTING_KEYS.desktopOssAccessKeySecret,
          value: values.ossAccessKeySecret.trim(),
        });
      }
      if (values.ossPath !== initialValues.ossPath) {
        updates.push({ key: SETTING_KEYS.desktopOssPath, value: values.ossPath.trim() });
      }

      if (updates.length === 0) {
        message.info(t('admin.desktopUpdate.noChanges', '没有需要保存的变更'));
        return;
      }

      setSubmitting(true);
      await adminCommercialService.setAppSettingsBatch({ updates });
      message.success(t('admin.desktopUpdate.saveSuccess', '桌面端更新设置已保存'));
      await mutate(ADMIN_SETTINGS_SWR_KEY);
    } catch {
      message.error(t('admin.desktopUpdate.saveFailed', '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 720 }}>
      <Form disabled={isLoading} form={form} initialValues={initialValues} layout="vertical">
        <Divider plain>{t('admin.desktopUpdate.serverSection', '更新服务器')}</Divider>

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
            'stable 表示正式版发布，canary 表示预发布构建。',
          )}
        >
          <Radio.Group>
            <Radio value="stable">正式版（Stable）</Radio>
            <Radio value="canary">预发布版（Canary）</Radio>
          </Radio.Group>
        </Form.Item>

        <Divider plain>{t('admin.desktopUpdate.checkSection', '自动检查')}</Divider>

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

        <Divider plain>{t('admin.desktopUpdate.versionSection', '当前发布版本')}</Divider>

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

        <Divider plain>{t('admin.desktopUpdate.ossSection', '阿里云对象存储（OSS）')}</Divider>

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
            '存储桶内的路径前缀，例如 releases。最终地址格式为 https://{bucket}.{endpoint}/{path}/{channel}/latest.yml',
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
