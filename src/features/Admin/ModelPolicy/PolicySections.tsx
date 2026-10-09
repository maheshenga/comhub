'use client';

import { Button } from '@lobehub/ui/base-ui';
import type { FormInstance } from 'antd';
import { Alert, Form, Input, Radio, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import {
  GLOBAL_MODEL_POLICY_HELP_TEXT,
  MODEL_POLICY_MATRIX_PATH,
} from '@/features/Admin/adminModelPolicySettings';

import { AdminFormGrid, AdminSection } from '../layout';
import { normalizeListText } from './keys';

interface PolicySectionsProps {
  defaultModelOptions: { label: string; value: string }[];
  form: FormInstance;
  isLoading: boolean;
}

const PolicySections = ({ defaultModelOptions, form }: PolicySectionsProps) => {
  const { t } = useTranslation('subscription');
  const navigate = useNavigate();

  const handleNormalizeAllowlist = () => {
    form.setFieldValue('allowlistText', normalizeListText(form.getFieldValue('allowlistText')));
  };

  const handleNormalizeBlocklist = () => {
    form.setFieldValue('blocklistText', normalizeListText(form.getFieldValue('blocklistText')));
  };

  return (
    <>
      <Alert
        showIcon
        message={t('admin.modelPolicy.tip', GLOBAL_MODEL_POLICY_HELP_TEXT)}
        type="info"
        action={
          <Button size="small" onClick={() => navigate(MODEL_POLICY_MATRIX_PATH)}>
            打开矩阵
          </Button>
        }
      />

      <AdminSection
        title={t('admin.modelPolicy.statusSection', '策略状态')}
        description={t(
          'admin.modelPolicy.statusSectionDescription',
          '决定是否启用全局限制，以及列表采用允许还是禁用语义。',
        )}
      >
        <AdminFormGrid>
          <Form.Item
            label={t('admin.modelPolicy.enabled', '启用全局模型策略')}
            name="enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item label={t('admin.modelPolicy.mode', '策略模式')} name="mode">
            <Radio.Group
              options={[
                {
                  label: t('admin.modelPolicy.mode.blocklist', '禁用列表中的模型'),
                  value: 'blocklist',
                },
                {
                  label: t('admin.modelPolicy.mode.allowlist', '仅允许列表中的模型'),
                  value: 'allowlist',
                },
              ]}
            />
          </Form.Item>
        </AdminFormGrid>
      </AdminSection>

      <AdminSection
        title={t('admin.modelPolicy.listsSection', '全局模型列表')}
        description={t(
          'admin.modelPolicy.listsSectionDescription',
          '支持每行、逗号或分号分隔，输入框失焦时会自动去重并规范化。',
        )}
      >
        <AdminFormGrid>
          <Form.Item
            label={t('admin.modelPolicy.allowlist', '允许列表')}
            name="allowlistText"
            extra={t(
              'admin.modelPolicy.allowlist.help',
              '启用允许列表模式后，仅这些模型可以使用。每行一个条目。',
            )}
          >
            <Input.TextArea
              placeholder={'openai:gpt-4o-mini\ndeepseek:deepseek-chat'}
              rows={6}
              onBlur={handleNormalizeAllowlist}
            />
          </Form.Item>
          <Form.Item
            label={t('admin.modelPolicy.blocklist', '禁用列表')}
            name="blocklistText"
            extra={t(
              'admin.modelPolicy.blocklist.help',
              '启用禁用列表模式后，这些模型会被拒绝。每行一个条目。',
            )}
          >
            <Input.TextArea
              placeholder={'openai:o1*\n*:old-*'}
              rows={6}
              onBlur={handleNormalizeBlocklist}
            />
          </Form.Item>
        </AdminFormGrid>
      </AdminSection>

      <AdminSection
        title={t('admin.modelPolicy.scopeSection', '作用范围与兜底')}
        description={t(
          'admin.modelPolicy.scopeSectionDescription',
          '设置策略覆盖的调用类型、拒绝提示和未来自动切换使用的兜底模型。',
        )}
      >
        <AdminFormGrid>
          <Form.Item
            label={t('admin.modelPolicy.applyToEmbeddings', '应用到向量模型')}
            name="applyToEmbeddings"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label={t('admin.modelPolicy.applyToGenerateObject', '应用到结构化输出')}
            name="applyToGenerateObject"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label={t('admin.modelPolicy.fallback', '默认兜底模型')}
            name="defaultModelFallback"
            extra={t(
              'admin.modelPolicy.fallback.help',
              '用于安全兜底展示和后续自动切换；当前运行时仍会直接拒绝不允许的模型。',
            )}
          >
            <Input list="admin-model-policy-fallback-options" placeholder="gpt-4o-mini" />
          </Form.Item>
        </AdminFormGrid>
        <datalist id="admin-model-policy-fallback-options">
          {defaultModelOptions.map((item) => (
            <option key={item.value} value={item.value} />
          ))}
        </datalist>
        <Form.Item label={t('admin.modelPolicy.deniedMessage', '拒绝提示')} name="deniedMessage">
          <Input.TextArea rows={3} />
        </Form.Item>
      </AdminSection>
    </>
  );
};

PolicySections.displayName = 'PolicySections';

export default PolicySections;
