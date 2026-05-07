'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Divider, Form, Input, InputNumber, message, Select, Switch } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { SkillSorts } from '@/types/discover';

const SETTING_KEYS = {
  announcementContent: 'community.homeAnnouncement.content',
  announcementEnabled: 'community.homeAnnouncement.enabled',
  announcementTitle: 'community.homeAnnouncement.title',
  announcementType: 'community.homeAnnouncement.type',
  creatorRewardBannerEnabled: 'community.creatorRewardBanner.enabled',
  featuredAssistantPageSize: 'community.featuredAssistant.pageSize',
  featuredAssistantTitle: 'community.featuredAssistant.title',
  featuredAssistantsEnabled: 'community.featuredAssistants.enabled',
  featuredMcpPageSize: 'community.featuredMcp.pageSize',
  featuredMcpTitle: 'community.featuredMcp.title',
  featuredMcpsEnabled: 'community.featuredMcps.enabled',
  featuredSkillCategory: 'community.featuredSkill.category',
  featuredSkillPageSize: 'community.featuredSkill.pageSize',
  featuredSkillSort: 'community.featuredSkill.sort',
  featuredSkillTitle: 'community.featuredSkill.title',
  featuredSkillsEnabled: 'community.featuredSkills.enabled',
} as const;

type FormValues = {
  announcementContent: string;
  announcementEnabled: boolean;
  announcementTitle: string;
  announcementType: 'success' | 'info' | 'warning' | 'error';
  creatorRewardBannerEnabled: boolean;
  featuredAssistantPageSize: number;
  featuredAssistantTitle: string;
  featuredAssistantsEnabled: boolean;
  featuredMcpPageSize: number;
  featuredMcpTitle: string;
  featuredMcpsEnabled: boolean;
  featuredSkillCategory: string;
  featuredSkillPageSize: number;
  featuredSkillSort: SkillSorts;
  featuredSkillTitle: string;
  featuredSkillsEnabled: boolean;
};

const SWR_KEY = ['admin-settings'];

const AdminOperationsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const { data, isLoading } = useClientDataSWR(SWR_KEY, () =>
    adminCommercialService.getAllSettings(),
  );

  useEffect(() => {
    if (!data?.operationsConfig) return;
    const config = data.operationsConfig;
    form.setFieldsValue({
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
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      await Promise.all([
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.creatorRewardBannerEnabled,
          value: values.creatorRewardBannerEnabled,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.featuredAssistantsEnabled,
          value: values.featuredAssistantsEnabled,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.featuredAssistantPageSize,
          value: values.featuredAssistantPageSize,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.featuredAssistantTitle,
          value: values.featuredAssistantTitle,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.featuredMcpsEnabled,
          value: values.featuredMcpsEnabled,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.featuredMcpPageSize,
          value: values.featuredMcpPageSize,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.featuredMcpTitle,
          value: values.featuredMcpTitle,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.featuredSkillsEnabled,
          value: values.featuredSkillsEnabled,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.featuredSkillPageSize,
          value: values.featuredSkillPageSize,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.featuredSkillTitle,
          value: values.featuredSkillTitle,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.featuredSkillCategory,
          value: values.featuredSkillCategory,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.featuredSkillSort,
          value: values.featuredSkillSort || SkillSorts.InstallCount,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.announcementEnabled,
          value: values.announcementEnabled,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.announcementTitle,
          value: values.announcementTitle,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.announcementContent,
          value: values.announcementContent,
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.announcementType,
          value: values.announcementType,
        }),
      ]);
      message.success(t('admin.operations.saveSuccess', '运营配置已保存'));
      await mutate(SWR_KEY);
    } catch {
      message.error(t('admin.operations.saveFailed', '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 820 }}>
      <Alert
        showIcon
        type="info"
        message={t('admin.operations.tip', '这些配置会公开用于社区首页展示，不会暴露敏感数据。')}
      />
      <Form
        disabled={isLoading}
        form={form}
        layout="vertical"
        initialValues={{
          announcementEnabled: false,
          announcementType: 'info',
          creatorRewardBannerEnabled: true,
          featuredAssistantPageSize: 12,
          featuredAssistantsEnabled: true,
          featuredMcpPageSize: 12,
          featuredMcpsEnabled: true,
          featuredSkillPageSize: 8,
          featuredSkillSort: SkillSorts.InstallCount,
          featuredSkillsEnabled: false,
        }}
      >
        <Divider plain>{t('admin.operations.bannerSection', '社区横幅')}</Divider>
        <Form.Item
          label={t('admin.operations.creatorRewardBanner', '显示创作者奖励横幅')}
          name="creatorRewardBannerEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.announcementEnabled', '显示首页公告')}
          name="announcementEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.announcementType', '公告类型')}
          name="announcementType"
        >
          <Select
            options={[
              { label: '信息（Info）', value: 'info' },
              { label: '成功（Success）', value: 'success' },
              { label: '警告（Warning）', value: 'warning' },
              { label: '错误（Error）', value: 'error' },
            ]}
          />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.announcementTitle', '公告标题')}
          name="announcementTitle"
        >
          <Input />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.announcementContent', '公告内容')}
          name="announcementContent"
        >
          <Input.TextArea rows={4} />
        </Form.Item>

        <Divider plain>{t('admin.operations.featuredSection', '精选模块')}</Divider>
        <Form.Item
          label={t('admin.operations.featuredAssistantsEnabled', '显示精选助手')}
          name="featuredAssistantsEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.featuredAssistantTitle', '助手模块标题')}
          name="featuredAssistantTitle"
        >
          <Input placeholder={t('home.featuredAssistants', { ns: 'discover' })} />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.featuredAssistantPageSize', '助手数量')}
          name="featuredAssistantPageSize"
        >
          <InputNumber max={24} min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.featuredMcpsEnabled', '显示精选 MCP/工具')}
          name="featuredMcpsEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.featuredMcpTitle', 'MCP 模块标题')}
          name="featuredMcpTitle"
        >
          <Input placeholder={t('home.featuredTools', { ns: 'discover' })} />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.featuredMcpPageSize', 'MCP 数量')}
          name="featuredMcpPageSize"
        >
          <InputNumber max={24} min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.featuredSkillsEnabled', '显示精选技能')}
          name="featuredSkillsEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.featuredSkillTitle', '技能模块标题')}
          name="featuredSkillTitle"
        >
          <Input placeholder={t('admin.operations.defaultSkillTitle', '精选技能')} />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.featuredSkillCategory', '技能分类')}
          name="featuredSkillCategory"
        >
          <Input placeholder="productivity-tasks" />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.featuredSkillSort', '技能排序')}
          name="featuredSkillSort"
        >
          <Select
            options={[
              { label: '安装量（Install Count）', value: SkillSorts.InstallCount },
              { label: '星标数（Stars）', value: SkillSorts.Stars },
              { label: '更新时间（Updated At）', value: SkillSorts.UpdatedAt },
              { label: '创建时间（Created At）', value: SkillSorts.CreatedAt },
            ]}
          />
        </Form.Item>
        <Form.Item
          label={t('admin.operations.featuredSkillPageSize', '技能数量')}
          name="featuredSkillPageSize"
        >
          <InputNumber max={24} min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Button loading={submitting} type="primary" onClick={handleSave}>
          {t('admin.settings.save', '保存')}
        </Button>
      </Form>
    </Flexbox>
  );
});

AdminOperationsPage.displayName = 'AdminOperationsPage';

export default AdminOperationsPage;
