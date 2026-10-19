'use client';

import { Flexbox } from '@lobehub/ui';
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Select,
  Switch,
  TextArea,
  toast,
} from '@lobehub/ui/base-ui';
import { Form, useForm } from '@lobehub/ui/base-ui/form';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ADMIN_SETTINGS_SECTION_SWR_KEY } from '@/const/adminCacheKeys';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import {
  AdminFormActions,
  AdminFormGrid,
  AdminPageError,
  AdminPageShell,
  AdminSection,
} from './layout';
import ChannelSettingsSection from './Notifications/ChannelSettingsSection';
import {
  buildInitialValues,
  buildNotificationMaterializationUpdates,
  buildUpdates,
  type NotificationSettingsForm,
} from './Notifications/shared';

const SYSTEM_TYPE_OPTIONS = [
  { label: '信息', value: 'info' },
  { label: '成功', value: 'success' },
  { label: '警告', value: 'warning' },
  { label: '错误', value: 'error' },
];

const AdminNotificationsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useClientDataSWR(ADMIN_SETTINGS_SECTION_SWR_KEY('notifications'), () =>
    adminCommercialService.getSettingsSection('notifications'),
  );
  const form = useForm<NotificationSettingsForm>();
  const [materializing, setMaterializing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const initialValues = useMemo(() => buildInitialValues(data), [data]);

  useEffect(() => {
    if (!data) return;
    form.setValues(buildInitialValues(data));
  }, [data, form]);

  const handleSave = async () => {
    if (!data) return;

    const { valid } = await form.validate();
    if (!valid) return;

    const values = form.getValues();
    const updates = buildUpdates(values, initialValues);

    if (updates.length === 0) {
      toast.info(t('admin.notifications.noChanges', '没有需要保存的变更'));
      return;
    }

    setSubmitting(true);
    try {
      await adminCommercialService.setAppSettingsBatch({ updates });
      await mutate('public-notification-config');
      toast.success(t('admin.notifications.saveSuccess', '通知配置已保存'));
    } catch {
      toast.error(t('admin.notifications.saveFailed', '保存通知配置失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMaterializeDefaults = async () => {
    if (!data) return;

    const { valid } = await form.validate();
    if (!valid) return;

    const values = form.getValues();
    const updates = buildNotificationMaterializationUpdates(values);

    setMaterializing(true);
    try {
      await adminCommercialService.setAppSettingsBatch({ updates });
      await mutate('public-notification-config');
      toast.success(t('admin.notifications.materializeDefaultsSuccess', '通知默认值已同步'));
    } catch {
      toast.error(t('admin.notifications.materializeDefaultsFailed', '同步通知默认值失败'));
    } finally {
      setMaterializing(false);
    }
  };

  return (
    <AdminPageShell
      title={t('admin.notifications.title', '公告与通知')}
      width="medium"
      description={t(
        'admin.notifications.subtitle',
        '统一管理站内、邮件和推送默认策略，以及系统公告与通知保留时间。',
      )}
    >
      <Alert
        showIcon
        type="info"
        message={t(
          'admin.notifications.analysis',
          '邮件和推送开关是默认投递策略，只有对应投递渠道已配置时才会实际发送。',
        )}
      />
      {error ? (
        <AdminPageError
          description={t('admin.notifications.loadFailed', '无法读取当前通知配置，请重试。')}
          onRetry={refresh}
        />
      ) : null}

      <Form form={form} layout="vertical">
        <fieldset disabled={isLoading} style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}>
          <Flexbox gap={24}>
            <ChannelSettingsSection />

            <AdminSection
              carded
              title={t('admin.notifications.compatibility', '兼容与保留策略')}
              description={t(
                'admin.notifications.compatibilityDescription',
                '保留旧桌面端读取兼容项，并设置归档通知的清理周期。',
              )}
            >
              <AdminFormGrid>
                <Form.Field
                  label={t('admin.notifications.desktopEnabled', '旧桌面通知默认值')}
                  name="desktopEnabled"
                  valueProp="checked"
                  extra={t(
                    'admin.notifications.desktopEnabled.help',
                    '仅供旧桌面端通知读取器使用；新版本由移动推送渠道控制。',
                  )}
                >
                  <Switch />
                </Form.Field>
                <Form.Field
                  label={t('admin.notifications.retentionDays', '归档通知保留天数')}
                  name="retentionDays"
                  extra={t(
                    'admin.notifications.retentionDays.help',
                    '维护任务会删除超过该天数的已归档通知。',
                  )}
                >
                  <InputNumber max={3650} min={1} style={{ width: '100%' }} />
                </Form.Field>
              </AdminFormGrid>
            </AdminSection>

            <AdminSection
              carded
              title={t('admin.notifications.system', '系统公告')}
              description={t(
                'admin.notifications.systemDescription',
                '配置向所有用户展示的系统级公告及可选操作入口。',
              )}
            >
              <AdminFormGrid>
                <Form.Field
                  label={t('admin.notifications.systemEnabled', '启用系统公告')}
                  name="systemEnabled"
                  valueProp="checked"
                >
                  <Switch />
                </Form.Field>
                <Form.Field
                  label={t('admin.notifications.systemType', '公告类型')}
                  name="systemType"
                >
                  <Select disabled={isLoading} options={SYSTEM_TYPE_OPTIONS} />
                </Form.Field>
                <Form.Field
                  label={t('admin.notifications.systemTitle', '公告标题')}
                  name="systemTitle"
                >
                  <Input placeholder="服务升级通知" />
                </Form.Field>
                <Form.Field
                  label={t('admin.notifications.systemActionLabel', '操作按钮名称')}
                  name="systemActionLabel"
                >
                  <Input placeholder="查看详情" />
                </Form.Field>
                <Form.Field
                  label={t('admin.notifications.systemActionUrl', '操作跳转地址')}
                  name="systemActionUrl"
                >
                  <Input placeholder="https://..." />
                </Form.Field>
              </AdminFormGrid>
              <Form.Field
                label={t('admin.notifications.systemContent', '公告内容')}
                name="systemContent"
              >
                <TextArea autoSize={{ minRows: 3 }} placeholder="向用户展示的公告内容" />
              </Form.Field>
            </AdminSection>

            <AdminFormActions label={t('admin.notifications.actions', '通知配置操作')}>
              <Button
                disabled={isLoading || !data || submitting}
                loading={materializing}
                onClick={handleMaterializeDefaults}
              >
                {t('admin.notifications.materializeDefaults', '同步默认值')}
              </Button>
              <Button
                disabled={isLoading || !data || materializing}
                loading={submitting}
                type="primary"
                onClick={handleSave}
              >
                {t('admin.notifications.save', '保存通知配置')}
              </Button>
            </AdminFormActions>
          </Flexbox>
        </fieldset>
      </Form>
    </AdminPageShell>
  );
});

AdminNotificationsPage.displayName = 'AdminNotificationsPage';

export default AdminNotificationsPage;
