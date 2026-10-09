'use client';

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Flexbox } from '@lobehub/ui';
import { Button, Select, Tabs } from '@lobehub/ui/base-ui';
import { Form, Input, Typography } from 'antd';

const { Text } = Typography;
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import { HELP_MENU_ACTIONS, HELP_MENU_ICONS } from '@/const/helpMenu';
import { type AdminSettingsFormValues } from '@/features/Admin/adminSettingsForm';

import {
  AssistantSettingsCard,
  BrandSettingsCard,
  EntryCopySettingsCard,
} from './SettingsCards';

const helpMenuActionOptions = HELP_MENU_ACTIONS.map((value) => ({ label: value, value }));
const helpMenuIconOptions = HELP_MENU_ICONS.map((value) => ({ label: value, value }));

const aboutLinkGroups = [
  { key: 'contact', title: '联系入口', titleKey: 'admin.settings.aboutLinks.contact' },
  { key: 'information', title: '社区与资讯', titleKey: 'admin.settings.aboutLinks.information' },
  { key: 'legal', title: '法律声明', titleKey: 'admin.settings.aboutLinks.legal' },
] as const;

interface SettingsTabsProps {
  form: ReturnType<typeof Form.useForm<AdminSettingsFormValues>>[0];
  uploadPublicUrlPrefix?: string;
  watchedValues?: Partial<AdminSettingsFormValues>;
}

const SettingsTabs = memo<SettingsTabsProps>(({ uploadPublicUrlPrefix }) => {
  const { t } = useTranslation('subscription');

  const renderAboutLinkGroup = (group: (typeof aboutLinkGroups)[number]) => (
    <Form.List key={group.key} name={['aboutLinks', group.key]}>
      {(fields) => (
        <Flexbox gap={8}>
          <Text strong>{t(group.titleKey, group.title)}</Text>
          {fields.map(({ key, name, ...restField }) => (
            <Flexbox horizontal align="center" gap={8} key={key}>
              <Form.Item {...restField} hidden name={[name, 'id']}>
                <Input />
              </Form.Item>
              <Form.Item
                {...restField}
                noStyle
                name={[name, 'label']}
                rules={[
                  {
                    message: t('admin.settings.aboutLinks.labelRequired', '请填写名称'),
                    required: true,
                  },
                ]}
              >
                <Input
                  placeholder={t('admin.settings.aboutLinks.label', '名称')}
                  style={{ flex: 1 }}
                />
              </Form.Item>
              <Form.Item
                {...restField}
                noStyle
                name={[name, 'url']}
                rules={[
                  {
                    message: t('admin.settings.aboutLinks.urlRequired', '请填写链接'),
                    required: true,
                  },
                ]}
              >
                <Input placeholder="https://..." style={{ flex: 1.6 }} />
              </Form.Item>
            </Flexbox>
          ))}
        </Flexbox>
      )}
    </Form.List>
  );

  return (
    <Tabs
          items={[
            {
              children: <BrandSettingsCard />,
              key: 'brand',
              label: t('admin.settings.brandTab', '品牌与登录'),
            },
            {
              children: <AssistantSettingsCard uploadPublicUrlPrefix={uploadPublicUrlPrefix} />,
              key: 'assistant',
              label: t('admin.settings.assistantTab', '默认助手外观'),
            },
            {
              children: <EntryCopySettingsCard />,
              key: 'entry',
              label: t('admin.settings.entryTab', '站点入口文案'),
            },
            {
              children: (
                <Card>
                  <Flexbox gap={16}>
                    <Text type="secondary">
                      {t(
                        'admin.settings.aboutLinks.help',
                        'Configure settings/about links. Labels and URLs display from this page; blank values use defaults.',
                      )}
                    </Text>
                    {aboutLinkGroups.map(renderAboutLinkGroup)}
                    <Text strong>
                      {t('admin.settings.aboutPageVersion', 'About page version area')}
                    </Text>
                    <Form.Item
                      label={t('admin.settings.aboutPageLogoLinkUrl', 'Logo link URL')}
                      name={['aboutPage', 'logoLinkUrl']}
                      extra={t(
                        'admin.settings.aboutPageLogoLinkUrl.help',
                        'Controls the settings/about version logo link. Blank values use the official site.',
                      )}
                    >
                      <Input placeholder="https://example.com" />
                    </Form.Item>
                    <Form.Item
                      label={t('admin.settings.aboutPageChangelogLabel', 'Changelog button label')}
                      name={['aboutPage', 'changelogLabel']}
                      extra={t(
                        'admin.settings.aboutPageChangelogLabel.help',
                        'Blank values use the default changelog translation.',
                      )}
                    >
                      <Input placeholder={t('changelog', 'Changelog')} />
                    </Form.Item>
                    <Form.Item
                      label={t('admin.settings.aboutPageChangelogUrl', 'Changelog URL')}
                      name={['aboutPage', 'changelogUrl']}
                    >
                      <Input placeholder="https://example.com/changelog" />
                    </Form.Item>
                    <Form.Item
                      label={t('admin.settings.helpMenuItems', '帮助菜单')}
                      extra={t(
                        'admin.settings.helpMenuItems.help',
                        '配置客户端帮助菜单。每项需要显示名称，链接 URL 可选。',
                      )}
                    >
                      <Form.List name="helpMenuItems">
                        {(fields, { add, remove }) => (
                          <Flexbox gap={8}>
                            {fields.map(({ key, name, ...restField }) => (
                              <Flexbox
                                horizontal
                                align="center"
                                gap={8}
                                key={key}
                                style={{ flexWrap: 'wrap' }}
                              >
                                <Form.Item {...restField} hidden name={[name, 'key']}>
                                  <Input />
                                </Form.Item>
                                <Form.Item
                                  {...restField}
                                  noStyle
                                  name={[name, 'label']}
                                  rules={[
                                    { message: 'Please enter a display name', required: true },
                                  ]}
                                >
                                  <Input placeholder="Display name" style={{ flex: 1 }} />
                                </Form.Item>
                                <Form.Item {...restField} noStyle name={[name, 'icon']}>
                                  <Select
                                    options={helpMenuIconOptions}
                                    placeholder="icon"
                                    style={{ minWidth: 132 }}
                                  />
                                </Form.Item>
                                <Form.Item {...restField} noStyle name={[name, 'action']}>
                                  <Select
                                    options={helpMenuActionOptions}
                                    placeholder="action"
                                    style={{ minWidth: 144 }}
                                  />
                                </Form.Item>
                                <Form.Item {...restField} noStyle name={[name, 'url']}>
                                  <Input placeholder="https://..." style={{ flex: 1.5 }} />
                                </Form.Item>
                                <MinusCircleOutlined
                                  style={{ color: '#ff4d4f' }}
                                  onClick={() => remove(name)}
                                />
                              </Flexbox>
                            ))}
                            <Button
                              block
                              icon={<PlusOutlined />}
                              type="dashed"
                              onClick={() =>
                                add({
                                  action: 'url',
                                  enabled: true,
                                  icon: 'help',
                                  label: '',
                                  url: '',
                                })
                              }
                            >
                              {t('admin.settings.helpMenuAdd', '添加菜单项')}
                            </Button>
                          </Flexbox>
                        )}
                      </Form.List>
                    </Form.Item>
                  </Flexbox>
                </Card>
              ),
              key: 'links',
              label: t('admin.settings.linksTab', '关于与帮助'),
            },
          ]}
        />
  );
});

SettingsTabs.displayName = 'SettingsTabs';

export default SettingsTabs;
