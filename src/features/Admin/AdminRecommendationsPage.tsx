'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Divider, Form, Input, message, Select, Switch } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { SkillSorts } from '@/types/discover';

const SETTING_KEYS = {
  assistantsEnabled: 'recommendation.assistants.enabled',
  assistantTags: 'recommendation.assistantTags',
  enabled: 'recommendation.section.enabled',
  generalSkillsEnabled: 'recommendation.generalSkills.enabled',
  generalSkillCategories: 'recommendation.generalSkillCategories',
  hotSkillsEnabled: 'recommendation.hotSkills.enabled',
  hotSkillSort: 'recommendation.hotSkillSort',
  mcpsEnabled: 'recommendation.mcps.enabled',
  mcpCategories: 'recommendation.mcpCategories',
  selectedTags: 'recommendation.selectedTags',
  skillsEnabled: 'recommendation.skills.enabled',
  skillCategories: 'recommendation.skillCategories',
} as const;

type FormValues = {
  assistantsEnabled: boolean;
  assistantTags: string;
  enabled: boolean;
  generalSkillsEnabled: boolean;
  generalSkillCategories: string;
  hotSkillsEnabled: boolean;
  hotSkillSort: SkillSorts;
  mcpsEnabled: boolean;
  mcpCategories: string;
  selectedTags: string;
  skillsEnabled: boolean;
  skillCategories: string;
};

const SWR_KEY = ['admin-settings'];
const splitList = (value: unknown) =>
  (typeof value === 'string' ? value.split(/[\r\n,;；，]+/) : [])
    .map((item) => item.trim())
    .filter(Boolean);
const joinList = (value?: string[]) => (value ?? []).join('\n');

const AdminRecommendationsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const { data, isLoading } = useClientDataSWR(SWR_KEY, () =>
    adminCommercialService.getAllSettings(),
  );

  useEffect(() => {
    if (!data?.recommendationConfig) return;
    form.setFieldsValue({
      assistantsEnabled: data.recommendationConfig.assistantsEnabled,
      assistantTags: joinList(data.recommendationConfig.assistantTags),
      enabled: data.recommendationConfig.enabled,
      generalSkillsEnabled: data.recommendationConfig.generalSkillsEnabled,
      generalSkillCategories: joinList(data.recommendationConfig.generalSkillCategories),
      hotSkillsEnabled: data.recommendationConfig.hotSkillsEnabled,
      hotSkillSort: data.recommendationConfig.hotSkillSort as SkillSorts,
      mcpsEnabled: data.recommendationConfig.mcpsEnabled,
      mcpCategories: joinList(data.recommendationConfig.mcpCategories),
      selectedTags: joinList(data.recommendationConfig.selectedTags),
      skillsEnabled: data.recommendationConfig.skillsEnabled,
      skillCategories: joinList(data.recommendationConfig.skillCategories),
    });
  }, [data, form]);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      await Promise.all([
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.enabled,
          value: Boolean(values.enabled),
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.assistantsEnabled,
          value: Boolean(values.assistantsEnabled),
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.mcpsEnabled,
          value: Boolean(values.mcpsEnabled),
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.skillsEnabled,
          value: Boolean(values.skillsEnabled),
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.generalSkillsEnabled,
          value: Boolean(values.generalSkillsEnabled),
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.hotSkillsEnabled,
          value: Boolean(values.hotSkillsEnabled),
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.selectedTags,
          value: splitList(values.selectedTags),
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.assistantTags,
          value: splitList(values.assistantTags),
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.skillCategories,
          value: splitList(values.skillCategories),
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.mcpCategories,
          value: splitList(values.mcpCategories),
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.generalSkillCategories,
          value: splitList(values.generalSkillCategories),
        }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.hotSkillSort,
          value: values.hotSkillSort || SkillSorts.InstallCount,
        }),
      ]);
      message.success(t('admin.recommendations.saveSuccess', '推荐配置已保存'));
      await mutate(SWR_KEY);
    } catch {
      message.error(t('admin.recommendations.saveFailed', '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 760 }}>
      <Form
        disabled={isLoading}
        form={form}
        layout="vertical"
        initialValues={{
          assistantsEnabled: true,
          enabled: false,
          generalSkillsEnabled: true,
          hotSkillSort: SkillSorts.InstallCount,
          hotSkillsEnabled: true,
          mcpsEnabled: true,
          skillsEnabled: true,
        }}
      >
        <Form.Item
          label={t('admin.recommendations.enabled', '启用推荐模块')}
          name="enabled"
          valuePropName="checked"
          extra={t(
            'admin.recommendations.enabled.help',
            '启用后，社区首页会显示由后台控制的推荐模块。',
          )}
        >
          <Switch />
        </Form.Item>
        <Divider plain>{t('admin.recommendations.criteria', '推荐条件')}</Divider>
        <Form.Item
          label={t('admin.recommendations.selectedTags', '用户选择标签')}
          name="selectedTags"
          extra={t(
            'admin.recommendations.selectedTags.help',
            '作为当前推荐主题展示的标签，每行填写一个。',
          )}
        >
          <Input.TextArea placeholder={'productivity\ncoding\nwriting'} rows={4} />
        </Form.Item>
        <Form.Item
          label={t('admin.recommendations.assistantsEnabled', '显示推荐助手')}
          name="assistantsEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label={t('admin.recommendations.assistantTags', '助手标签/分类')}
          name="assistantTags"
        >
          <Input.TextArea placeholder={'programming\noffice\ntranslation'} rows={4} />
        </Form.Item>
        <Form.Item
          label={t('admin.recommendations.mcpsEnabled', '显示推荐 MCP/工具')}
          name="mcpsEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label={t('admin.recommendations.mcpCategories', 'MCP 分类')}
          name="mcpCategories"
        >
          <Input.TextArea placeholder={'productivity\ntools\nweb-search'} rows={4} />
        </Form.Item>
        <Form.Item
          label={t('admin.recommendations.skillsEnabled', '显示推荐技能')}
          name="skillsEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label={t('admin.recommendations.skillCategories', '推荐技能分类')}
          name="skillCategories"
        >
          <Input.TextArea placeholder={'coding-agents-ides\nsearch-research'} rows={4} />
        </Form.Item>
        <Form.Item
          label={t('admin.recommendations.generalSkillsEnabled', '显示通用技能')}
          name="generalSkillsEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label={t('admin.recommendations.generalSkillCategories', '通用技能分类')}
          name="generalSkillCategories"
        >
          <Input.TextArea placeholder={'productivity-tasks\nbrowser-automation'} rows={4} />
        </Form.Item>
        <Form.Item
          label={t('admin.recommendations.hotSkillsEnabled', '显示热门技能')}
          name="hotSkillsEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label={t('admin.recommendations.hotSkillSort', '热门技能排序')}
          name="hotSkillSort"
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
        <Button loading={submitting} type="primary" onClick={handleSave}>
          {t('admin.settings.save', '保存')}
        </Button>
      </Form>
    </Flexbox>
  );
});

AdminRecommendationsPage.displayName = 'AdminRecommendationsPage';

export default AdminRecommendationsPage;
