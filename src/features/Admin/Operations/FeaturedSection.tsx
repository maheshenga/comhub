'use client';

import { Select } from '@lobehub/ui/base-ui';
import { Form, Input, InputNumber, Switch } from 'antd';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import { SkillSorts } from '@/types/discover';

import { AdminFormGrid, AdminSection } from '../layout';

const FeaturedSection = ({ isLoading }: { isLoading: boolean }) => {
  const { t } = useTranslation('subscription');

  return (
          <AdminSection
            title={t('admin.operations.featuredSection', '精选模块')}
            description={t(
              'admin.operations.featuredSectionDescription',
              '分别设置首页精选助手、工具和技能的标题、数量与排序。',
            )}
          >
            <AdminFormGrid columns={3} label={t('admin.operations.featuredSection', '精选模块')}>
              <Card title={t('admin.operations.featuredAssistantsGroup', '精选助手')}>
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
              </Card>

              <Card title={t('admin.operations.featuredMcpsGroup', '精选 MCP / 工具')}>
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
              </Card>

              <Card title={t('admin.operations.featuredSkillsGroup', '精选技能')}>
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
                    disabled={isLoading}
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
              </Card>
            </AdminFormGrid>
          </AdminSection>
  );
};

FeaturedSection.displayName = 'FeaturedSection';

export default FeaturedSection;
