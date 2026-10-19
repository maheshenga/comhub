'use client';

import { Input, Select, Switch, TextArea } from '@lobehub/ui/base-ui';
import { Form } from '@lobehub/ui/base-ui/form';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import { SkillSorts } from '@/types/discover';

import { AdminFormGrid, AdminSection } from '../layout';

const SectionCards = ({ isLoading }: { isLoading: boolean }) => {
  const { t } = useTranslation('subscription');

  return (
    <AdminSection
      carded
      title={t('admin.recommendations.sections', '推荐版块')}
      description={t(
        'admin.recommendations.sectionsDescription',
        '每个版块可独立控制显示状态、标题和筛选范围。',
      )}
    >
      <AdminFormGrid label={t('admin.recommendations.sections', '推荐版块')}>
        <Card title={t('admin.recommendations.assistantsCard', '推荐助手')}>
          <Form.Field
            label={t('admin.recommendations.assistantsEnabled', '显示推荐助手')}
            name="assistantsEnabled"
            valueProp="checked"
          >
            <Switch />
          </Form.Field>
          <Form.Field
            label={t('admin.recommendations.assistantTitle', '助手模块标题')}
            name="assistantTitle"
          >
            <Input />
          </Form.Field>
          <Form.Field
            label={t('admin.recommendations.assistantTags', '助手标签/分类')}
            name="assistantTags"
          >
            <TextArea placeholder={'programming\noffice\ntranslation'} rows={4} />
          </Form.Field>
        </Card>

        <Card title={t('admin.recommendations.mcpsCard', '推荐 MCP / 工具')}>
          <Form.Field
            label={t('admin.recommendations.mcpsEnabled', '显示推荐 MCP/工具')}
            name="mcpsEnabled"
            valueProp="checked"
          >
            <Switch />
          </Form.Field>
          <Form.Field label={t('admin.recommendations.mcpTitle', 'MCP 模块标题')} name="mcpTitle">
            <Input />
          </Form.Field>
          <Form.Field
            label={t('admin.recommendations.mcpCategories', 'MCP 分类')}
            name="mcpCategories"
          >
            <TextArea placeholder={'productivity\ntools\nweb-search'} rows={4} />
          </Form.Field>
        </Card>

        <Card title={t('admin.recommendations.skillsCard', '推荐技能')}>
          <Form.Field
            label={t('admin.recommendations.skillsEnabled', '显示推荐技能')}
            name="skillsEnabled"
            valueProp="checked"
          >
            <Switch />
          </Form.Field>
          <Form.Field
            label={t('admin.recommendations.skillTitle', '技能模块标题')}
            name="skillTitle"
          >
            <Input />
          </Form.Field>
          <Form.Field
            label={t('admin.recommendations.skillCategories', '推荐技能分类')}
            name="skillCategories"
          >
            <TextArea placeholder={'coding-agents-ides\nsearch-research'} rows={4} />
          </Form.Field>
        </Card>

        <Card title={t('admin.recommendations.generalSkillsCard', '通用技能')}>
          <Form.Field
            label={t('admin.recommendations.generalSkillsEnabled', '显示通用技能')}
            name="generalSkillsEnabled"
            valueProp="checked"
          >
            <Switch />
          </Form.Field>
          <Form.Field
            label={t('admin.recommendations.generalSkillTitle', '通用技能模块标题')}
            name="generalSkillTitle"
          >
            <Input />
          </Form.Field>
          <Form.Field
            label={t('admin.recommendations.generalSkillCategories', '通用技能分类')}
            name="generalSkillCategories"
          >
            <TextArea placeholder={'productivity-tasks\nbrowser-automation'} rows={4} />
          </Form.Field>
        </Card>

        <Card title={t('admin.recommendations.hotSkillsCard', '热门技能')}>
          <Form.Field
            label={t('admin.recommendations.hotSkillsEnabled', '显示热门技能')}
            name="hotSkillsEnabled"
            valueProp="checked"
          >
            <Switch />
          </Form.Field>
          <Form.Field
            label={t('admin.recommendations.hotSkillTitle', '热门技能模块标题')}
            name="hotSkillTitle"
          >
            <Input />
          </Form.Field>
          <Form.Field
            label={t('admin.recommendations.hotSkillSort', '热门技能排序')}
            name="hotSkillSort"
          >
            <Select
              disabled={isLoading}
              options={[
                { label: '安装量（Install Count）', value: SkillSorts.InstallCount },
                { label: '星标数（Stars）', value: SkillSorts.Stars },
                { label: '更新时间（Updated At）', value: SkillSorts.UpdatedAt },
                { label: '创建时间（Created At）', value: SkillSorts.CreatedAt },
              ]}
            />
          </Form.Field>
        </Card>
      </AdminFormGrid>
    </AdminSection>
  );
};

SectionCards.displayName = 'SectionCards';

export default SectionCards;
