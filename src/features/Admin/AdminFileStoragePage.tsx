'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Form, Input, InputNumber, message, Space, Switch, Typography } from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import { ADMIN_SETTINGS_SWR_KEY } from '@/const/adminCacheKeys';
import { normalizeText, SETTING_KEYS } from '@/features/Admin/adminSettingsForm';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text, Title } = Typography;

type FileStorageFormValues = {
  storageS3AccessKeyId: string;
  storageS3Bucket: string;
  storageS3EnablePathStyle: boolean;
  storageS3Endpoint: string;
  storageS3FilePath: string;
  storageS3PreviewUrlExpireIn: number;
  storageS3PublicDomain: string;
  storageS3Region: string;
  storageS3SecretAccessKey: string;
  storageS3SetAcl: boolean;
};

const normalizeS3FilePath = (value: unknown) =>
  normalizeText(value)
    .replaceAll('\\', '/')
    .replace(/^\/+|\/+$/g, '') || 'files';

const buildInitialValues = (data: any): FileStorageFormValues => ({
  storageS3AccessKeyId: data?.storageS3AccessKeyId ?? '',
  storageS3Bucket: data?.storageS3Bucket ?? '',
  storageS3EnablePathStyle: data?.storageS3EnablePathStyle ?? false,
  storageS3Endpoint: data?.storageS3Endpoint ?? '',
  storageS3FilePath: data?.storageS3FilePath ?? 'files',
  storageS3PreviewUrlExpireIn: data?.storageS3PreviewUrlExpireIn ?? 7200,
  storageS3PublicDomain: data?.storageS3PublicDomain ?? '',
  storageS3Region: data?.storageS3Region ?? '',
  storageS3SecretAccessKey: '',
  storageS3SetAcl: data?.storageS3SetAcl ?? false,
});

const normalizeValues = (values: FileStorageFormValues): FileStorageFormValues => ({
  storageS3AccessKeyId: normalizeText(values.storageS3AccessKeyId),
  storageS3Bucket: normalizeText(values.storageS3Bucket),
  storageS3EnablePathStyle: Boolean(values.storageS3EnablePathStyle),
  storageS3Endpoint: normalizeText(values.storageS3Endpoint),
  storageS3FilePath: normalizeS3FilePath(values.storageS3FilePath),
  storageS3PreviewUrlExpireIn:
    typeof values.storageS3PreviewUrlExpireIn === 'number'
      ? values.storageS3PreviewUrlExpireIn
      : 7200,
  storageS3PublicDomain: normalizeText(values.storageS3PublicDomain),
  storageS3Region: normalizeText(values.storageS3Region),
  storageS3SecretAccessKey: normalizeText(values.storageS3SecretAccessKey),
  storageS3SetAcl: Boolean(values.storageS3SetAcl),
});

const buildUpdates = (values: FileStorageFormValues, initial: FileStorageFormValues) => {
  const current = normalizeValues(values);
  const baseline = normalizeValues(initial);
  const updates: { key: string; value: unknown }[] = [];

  const fields: Array<keyof FileStorageFormValues> = [
    'storageS3AccessKeyId',
    'storageS3Endpoint',
    'storageS3FilePath',
    'storageS3Bucket',
    'storageS3Region',
    'storageS3PublicDomain',
    'storageS3EnablePathStyle',
    'storageS3SetAcl',
    'storageS3PreviewUrlExpireIn',
  ];

  const keyMap: Record<keyof FileStorageFormValues, string> = {
    storageS3AccessKeyId: SETTING_KEYS.storageS3AccessKeyId,
    storageS3Bucket: SETTING_KEYS.storageS3Bucket,
    storageS3EnablePathStyle: SETTING_KEYS.storageS3EnablePathStyle,
    storageS3Endpoint: SETTING_KEYS.storageS3Endpoint,
    storageS3FilePath: SETTING_KEYS.storageS3FilePath,
    storageS3PreviewUrlExpireIn: SETTING_KEYS.storageS3PreviewUrlExpireIn,
    storageS3PublicDomain: SETTING_KEYS.storageS3PublicDomain,
    storageS3Region: SETTING_KEYS.storageS3Region,
    storageS3SecretAccessKey: SETTING_KEYS.storageS3SecretAccessKey,
    storageS3SetAcl: SETTING_KEYS.storageS3SetAcl,
  };

  for (const field of fields) {
    if (current[field] !== baseline[field]) {
      updates.push({ key: keyMap[field], value: current[field] });
    }
  }

  if (current.storageS3SecretAccessKey) {
    updates.push({
      key: SETTING_KEYS.storageS3SecretAccessKey,
      value: current.storageS3SecretAccessKey,
    });
  }

  return updates;
};

const AdminFileStoragePage = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useClientDataSWR(ADMIN_SETTINGS_SWR_KEY, () =>
    adminCommercialService.getAllSettings(),
  );
  const [form] = Form.useForm<FileStorageFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);

  const initialValues = useMemo(() => buildInitialValues(data), [data]);

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue(buildInitialValues(data));
  }, [data, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const updates = buildUpdates(values, initialValues);

      if (updates.length === 0) {
        message.info(t('admin.fileStorage.noChanges', '没有需要保存的变更'));
        return;
      }

      setSubmitting(true);
      await adminCommercialService.setAppSettingsBatch({ updates });
      form.setFieldValue('storageS3SecretAccessKey', '');
      await mutate(ADMIN_SETTINGS_SWR_KEY);
      message.success(t('admin.fileStorage.saveSuccess', '文件存储设置已保存'));
    } catch {
      message.error(t('admin.fileStorage.saveFailed', '保存失败，请检查 S3 配置'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await adminCommercialService.testS3Storage();
      const checkSummary = result.checks
        ? 'Bucket、CORS、预签名上传、读取、删除均通过'
        : '连接正常';
      message.success(
        t(
          'admin.fileStorage.testSuccess',
          `S3 测试通过：${result.bucket}（${result.filePath}），${checkSummary}`,
        ),
      );
    } catch (error) {
      message.error(
        `${t('admin.fileStorage.testFailed', 'S3 连接失败')}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 820 }}>
      <Flexbox gap={4}>
        <Title level={3} style={{ margin: 0 }}>
          {t('admin.fileStorage.title', '文件存储')}
        </Title>
        <Text type="secondary">
          {t(
            'admin.fileStorage.subtitle',
            '统一配置用户上传文件、头像、图片生成、视频生成等内容的 S3 兼容对象存储。',
          )}
        </Text>
      </Flexbox>

      <Alert
        showIcon
        type="info"
        message={t(
          'admin.fileStorage.help',
          '后台配置优先于服务器环境变量；留空字段会继续使用环境变量兜底。修改后后续请求立即使用新配置，不需要重新构建。',
        )}
      />

      <Form disabled={isLoading} form={form} initialValues={initialValues} layout="vertical">
        <Card title={t('admin.fileStorage.s3Section', 'S3 兼容存储')}>
          <Space style={{ marginBottom: 16 }}>
            <Button loading={testing} onClick={handleTest}>
              {t('admin.fileStorage.test', '测试 S3 连接')}
            </Button>
            <Text type="secondary">
              {t('admin.fileStorage.testHelp', '测试会校验当前已保存配置，不会写入文件。')}
            </Text>
          </Space>

          <Form.Item label="Access Key ID" name="storageS3AccessKeyId">
            <Input placeholder="S3_ACCESS_KEY_ID" />
          </Form.Item>
          <Form.Item
            extra={
              data?.storageS3SecretAccessKeyConfigured
                ? `${t('admin.fileStorage.current', '当前值')}: ${
                    data.storageS3SecretAccessKeyMasked || '已配置'
                  }`
                : t('admin.fileStorage.notSet', '未配置')
            }
            label="Secret Access Key"
            name="storageS3SecretAccessKey"
          >
            <Input.Password
              autoComplete="new-password"
              placeholder={t('admin.fileStorage.leaveBlank', '留空则保持当前值')}
            />
          </Form.Item>
          <Form.Item
            extra={t(
              'admin.fileStorage.endpointHelp',
              '填写 S3 兼容服务的 API 地址，例如 https://s3.amazonaws.com、https://oss-cn-hangzhou.aliyuncs.com 或 MinIO/RustFS 地址。',
            )}
            label="Endpoint 地址"
            name="storageS3Endpoint"
          >
            <Input placeholder="https://s3.example.com" />
          </Form.Item>
          <Form.Item label="Bucket 名称" name="storageS3Bucket">
            <Input placeholder="lobe" />
          </Form.Item>
          <Form.Item
            extra={t(
              'admin.fileStorage.regionHelp',
              'AWS S3 通常需要区域；MinIO/RustFS 可以留空或使用 us-east-1。',
            )}
            label="Region 区域"
            name="storageS3Region"
          >
            <Input placeholder="us-east-1" />
          </Form.Item>
          <Form.Item
            extra={t(
              'admin.fileStorage.publicDomainHelp',
              '当开启公开读 ACL 时用于拼接文件访问 URL；未配置或关闭公开读时系统会返回短期预签名 URL。',
            )}
            label="公开访问域名 / CDN"
            name="storageS3PublicDomain"
          >
            <Input placeholder="https://cdn.example.com" />
          </Form.Item>
          <Form.Item
            extra={t(
              'admin.fileStorage.filePathHelp',
              '用于生成对象 Key，例如 files/490000/mock.png。建议使用 files、uploads 或按业务命名的短前缀，不要以 / 开头。',
            )}
            label="上传目录前缀"
            name="storageS3FilePath"
          >
            <Input placeholder="files" />
          </Form.Item>
          <Form.Item
            extra={t(
              'admin.fileStorage.pathStyleHelp',
              'MinIO、RustFS 等自建 S3 通常需要开启；AWS/R2/OSS 多数场景可以关闭。',
            )}
            label="启用 Path-style 路径"
            name="storageS3EnablePathStyle"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            extra={t(
              'admin.fileStorage.setAclHelp',
              '只有对象存储允许 ACL 且需要直接公开访问时开启；否则建议关闭，系统会使用预签名 URL。',
            )}
            label="上传时设置 public-read ACL"
            name="storageS3SetAcl"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            extra={t(
              'admin.fileStorage.previewExpireHelp',
              '关闭公开读或未配置 CDN 时生效。建议 1800-7200 秒；过短会导致模型读取图片时 URL 过期。',
            )}
            label="预览 URL 有效期（秒）"
            name="storageS3PreviewUrlExpireIn"
          >
            <InputNumber max={604_800} min={60} style={{ width: '100%' }} />
          </Form.Item>
        </Card>

        <Space>
          <Button loading={submitting} type="primary" onClick={handleSave}>
            {t('admin.fileStorage.save', '保存文件存储设置')}
          </Button>
        </Space>
      </Form>
    </Flexbox>
  );
});

AdminFileStoragePage.displayName = 'AdminFileStoragePage';

export default AdminFileStoragePage;
