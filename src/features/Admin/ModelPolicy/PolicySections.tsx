'use client';

import { Alert, Button, Input, RadioGroup, Switch, TextArea } from '@lobehub/ui';
import { Form, type FormInstance } from '@lobehub/ui/form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import {
  GLOBAL_MODEL_POLICY_HELP_TEXT,
  MODEL_POLICY_MATRIX_PATH,
} from '@/features/Admin/adminModelPolicySettings';

import { AdminFormGrid, AdminSection } from '../layout';
import { type FormValues, normalizeListText } from './keys';

interface PolicySectionsProps {
  defaultModelOptions: { label: string; value: string }[];
  form: FormInstance<FormValues>;
  isLoading: boolean;
}

const PolicySections = ({ defaultModelOptions, form }: PolicySectionsProps) => {
  const { t } = useTranslation('subscription');
  const navigate = useNavigate();

  const handleNormalizeAllowlist = () => {
    form.setValue('allowlistText', normalizeListText(form.getValue('allowlistText')));
  };

  const handleNormalizeBlocklist = () => {
    form.setValue('blocklistText', normalizeListText(form.getValue('blocklistText')));
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
        carded
        title={t('admin.modelPolicy.statusSection', '策略状态')}
        description={t(
          'admin.modelPolicy.statusSectionDescription',
          '决定是否启用全局限制，以及列表采用允许还是禁用语义。',
        )}
      >
        <AdminFormGrid>
          <Form.Field
            label={t('admin.modelPolicy.enabled', '启用全局模型策略')}
            name="enabled"
            valueProp="checked"
          >
            <Switch />
          </Form.Field>
          <Form.Field label={t('admin.modelPolicy.mode', '策略模式')} name="mode">
            <RadioGroup
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
          </Form.Field>
        </AdminFormGrid>
      </AdminSection>

      <AdminSection
        carded
        title={t('admin.modelPolicy.listsSection', '全局模型列表')}
        description={t(
          'admin.modelPolicy.listsSectionDescription',
          '支持每行、逗号或分号分隔，输入框失焦时会自动去重并规范化。',
        )}
      >
        <AdminFormGrid>
          <Form.Field
            label={t('admin.modelPolicy.allowlist', '允许列表')}
            name="allowlistText"
            extra={t(
              'admin.modelPolicy.allowlist.help',
              '启用允许列表模式后，仅这些模型可以使用。每行一个条目。',
            )}
          >
            <TextArea
              placeholder={'openai:gpt-4o-mini\ndeepseek:deepseek-chat'}
              rows={6}
              onBlur={handleNormalizeAllowlist}
            />
          </Form.Field>
          <Form.Field
            label={t('admin.modelPolicy.blocklist', '禁用列表')}
            name="blocklistText"
            extra={t(
              'admin.modelPolicy.blocklist.help',
              '启用禁用列表模式后，这些模型会被拒绝。每行一个条目。',
            )}
          >
            <TextArea
              placeholder={'openai:o1*\n*:old-*'}
              rows={6}
              onBlur={handleNormalizeBlocklist}
            />
          </Form.Field>
        </AdminFormGrid>
      </AdminSection>

      <AdminSection
        carded
        title={t('admin.modelPolicy.scopeSection', '作用范围与兜底')}
        description={t(
          'admin.modelPolicy.scopeSectionDescription',
          '设置策略覆盖的调用类型、拒绝提示和未来自动切换使用的兜底模型。',
        )}
      >
        <AdminFormGrid>
          <Form.Field
            label={t('admin.modelPolicy.applyToEmbeddings', '应用到向量模型')}
            name="applyToEmbeddings"
            valueProp="checked"
          >
            <Switch />
          </Form.Field>
          <Form.Field
            label={t('admin.modelPolicy.applyToGenerateObject', '应用到结构化输出')}
            name="applyToGenerateObject"
            valueProp="checked"
          >
            <Switch />
          </Form.Field>
          <Form.Field
            label={t('admin.modelPolicy.fallback', '默认兜底模型')}
            name="defaultModelFallback"
            extra={t(
              'admin.modelPolicy.fallback.help',
              '用于安全兜底展示和后续自动切换；当前运行时仍会直接拒绝不允许的模型。',
            )}
          >
            <Input list="admin-model-policy-fallback-options" placeholder="gpt-4o-mini" />
          </Form.Field>
        </AdminFormGrid>
        <datalist id="admin-model-policy-fallback-options">
          {defaultModelOptions.map((item) => (
            <option key={item.value} value={item.value} />
          ))}
        </datalist>
        <Form.Field label={t('admin.modelPolicy.deniedMessage', '拒绝提示')} name="deniedMessage">
          <TextArea rows={3} />
        </Form.Field>
      </AdminSection>
    </>
  );
};

PolicySections.displayName = 'PolicySections';

export default PolicySections;
