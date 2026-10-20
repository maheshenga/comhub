'use client';

import { Alert, Button, Flexbox, Input, Select, Switch, TextArea, toast } from '@lobehub/ui';
import { Form, useForm } from '@lobehub/ui/form';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ADMIN_SETTINGS_SECTION_SWR_KEY } from '@/const/adminCacheKeys';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { SkillSorts } from '@/types/discover';

import {
  AdminFormActions,
  AdminFormGrid,
  AdminPageError,
  AdminPageShell,
  AdminSection,
} from './layout';
import FeaturedSection from './Operations/FeaturedSection';
import { type FormValues, SETTING_KEYS } from './Operations/shared';

const AdminOperationsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const form = useForm<FormValues>({
    initialValues: {
      announcementContent: '',
      announcementEnabled: false,
      announcementTitle: '',
      announcementType: 'info',
      creatorRewardBannerEnabled: true,
      featuredAssistantPageSize: 12,
      featuredAssistantTitle: '',
      featuredAssistantsEnabled: true,
      featuredMcpPageSize: 12,
      featuredMcpTitle: '',
      featuredMcpsEnabled: true,
      featuredSkillCategory: '',
      featuredSkillPageSize: 8,
      featuredSkillSort: SkillSorts.InstallCount,
      featuredSkillTitle: '',
      featuredSkillsEnabled: false,
    },
  });
  const [submitting, setSubmitting] = useState(false);
  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useClientDataSWR(ADMIN_SETTINGS_SECTION_SWR_KEY('operations'), () =>
    adminCommercialService.getSettingsSection('operations'),
  );

  useEffect(() => {
    if (!data?.operationsConfig) return;
    const config = data.operationsConfig;
    form.setValues({
      announcementContent: config.announcement.content,
      announcementEnabled: config.announcement.enabled,
      announcementTitle: config.announcement.title,
      announcementType: config.announcement.type as FormValues['announcementType'],
      creatorRewardBannerEnabled: config.creatorRewardBannerEnabled,
      featuredAssistantPageSize: config.featuredAssistants.pageSize,
      featuredAssistantTitle: config.featuredAssistants.title,
      featuredAssistantsEnabled: config.featuredAssistants.enabled,
      featuredMcpPageSize: config.featuredMcps.pageSize,
      featuredMcpTitle: config.featuredMcps.title,
      featuredMcpsEnabled: config.featuredMcps.enabled,
      featuredSkillCategory: config.featuredSkills.category,
      featuredSkillPageSize: config.featuredSkills.pageSize,
      featuredSkillSort: config.featuredSkills.sort as SkillSorts,
      featuredSkillTitle: config.featuredSkills.title,
      featuredSkillsEnabled: config.featuredSkills.enabled,
    });
  }, [data, form]);

  const handleSave = async () => {
    if (!data) return;

    const { valid } = await form.validate();
    if (!valid) return;

    setSubmitting(true);
    try {
      const values = form.getValues();
      await adminCommercialService.setAppSettingsBatch({
        updates: [
          {
            key: SETTING_KEYS.creatorRewardBannerEnabled,
            value: values.creatorRewardBannerEnabled,
          },
          {
            key: SETTING_KEYS.featuredAssistantsEnabled,
            value: values.featuredAssistantsEnabled,
          },
          {
            key: SETTING_KEYS.featuredAssistantPageSize,
            value: values.featuredAssistantPageSize,
          },
          {
            key: SETTING_KEYS.featuredAssistantTitle,
            value: values.featuredAssistantTitle,
          },
          {
            key: SETTING_KEYS.featuredMcpsEnabled,
            value: values.featuredMcpsEnabled,
          },
          {
            key: SETTING_KEYS.featuredMcpPageSize,
            value: values.featuredMcpPageSize,
          },
          {
            key: SETTING_KEYS.featuredMcpTitle,
            value: values.featuredMcpTitle,
          },
          {
            key: SETTING_KEYS.featuredSkillsEnabled,
            value: values.featuredSkillsEnabled,
          },
          {
            key: SETTING_KEYS.featuredSkillPageSize,
            value: values.featuredSkillPageSize,
          },
          {
            key: SETTING_KEYS.featuredSkillTitle,
            value: values.featuredSkillTitle,
          },
          {
            key: SETTING_KEYS.featuredSkillCategory,
            value: values.featuredSkillCategory,
          },
          {
            key: SETTING_KEYS.featuredSkillSort,
            value: values.featuredSkillSort || SkillSorts.InstallCount,
          },
          {
            key: SETTING_KEYS.announcementEnabled,
            value: values.announcementEnabled,
          },
          {
            key: SETTING_KEYS.announcementTitle,
            value: values.announcementTitle,
          },
          {
            key: SETTING_KEYS.announcementContent,
            value: values.announcementContent,
          },
          {
            key: SETTING_KEYS.announcementType,
            value: values.announcementType,
          },
        ],
      });
      toast.success(t('admin.operations.saveSuccess', '运营配置已保存'));
    } catch {
      toast.error(t('admin.operations.saveFailed', '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminPageShell
      title={t('admin.operations.title', '运营开关')}
      width="medium"
      description={t(
        'admin.operations.subtitle',
        '集中控制社区首页公告、创作者奖励横幅和精选内容展示。',
      )}
    >
      <Alert
        showIcon
        message={t('admin.operations.tip', '这些配置会公开用于社区首页展示，不会暴露敏感数据。')}
        type="info"
      />
      {error ? (
        <AdminPageError
          description={t('admin.operations.loadFailed', '无法读取当前运营配置，请重试。')}
          onRetry={refresh}
        />
      ) : null}
      <Form form={form} layout="vertical">
        <fieldset disabled={isLoading} style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}>
          <Flexbox gap={24}>
            <AdminSection
              carded
              title={t('admin.operations.bannerSection', '社区横幅')}
              description={t(
                'admin.operations.bannerSectionDescription',
                '管理社区入口的奖励提示和首页公告内容。',
              )}
            >
              <AdminFormGrid>
                <Form.Field
                  label={t('admin.operations.creatorRewardBanner', '显示创作者奖励横幅')}
                  name="creatorRewardBannerEnabled"
                  valueProp="checked"
                >
                  <Switch />
                </Form.Field>
                <Form.Field
                  label={t('admin.operations.announcementEnabled', '显示首页公告')}
                  name="announcementEnabled"
                  valueProp="checked"
                >
                  <Switch />
                </Form.Field>
                <Form.Field
                  label={t('admin.operations.announcementType', '公告类型')}
                  name="announcementType"
                >
                  <Select
                    disabled={isLoading}
                    options={[
                      { label: '信息（Info）', value: 'info' },
                      { label: '成功（Success）', value: 'success' },
                      { label: '警告（Warning）', value: 'warning' },
                      { label: '错误（Error）', value: 'error' },
                    ]}
                  />
                </Form.Field>
                <Form.Field
                  label={t('admin.operations.announcementTitle', '公告标题')}
                  name="announcementTitle"
                >
                  <Input />
                </Form.Field>
              </AdminFormGrid>
              <Form.Field
                label={t('admin.operations.announcementContent', '公告内容')}
                name="announcementContent"
              >
                <TextArea rows={4} />
              </Form.Field>
            </AdminSection>

            <FeaturedSection isLoading={isLoading} />

            <AdminFormActions label={t('admin.operations.actions', '运营配置操作')}>
              <Button
                disabled={isLoading || !data}
                loading={submitting}
                type="primary"
                onClick={handleSave}
              >
                {t('admin.settings.save', '保存')}
              </Button>
            </AdminFormActions>
          </Flexbox>
        </fieldset>
      </Form>
    </AdminPageShell>
  );
});

AdminOperationsPage.displayName = 'AdminOperationsPage';

export default AdminOperationsPage;
