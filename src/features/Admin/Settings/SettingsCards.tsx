'use client';

import { Form, Input, Switch } from 'antd';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import { DEFAULT_COMHUB_AGENT_AVATAR } from '@/const/defaultAgent';
import ImageUrlUploadInput from '@/features/Admin/components/ImageUrlUploadInput';

export const BrandSettingsCard = () => {
  const { t } = useTranslation('subscription');

  return (
    <Card>
      <Form.Item
        label={t('admin.settings.brandName', '品牌名称')}
        name="brandName"
        extra={t(
          'admin.settings.brandName.help',
          '用于页面标题、导航、关于页面和站内品牌展示。',
        )}
      >
        <Input placeholder="玄果 AI" />
      </Form.Item>
      <Form.Item
        label={t('admin.settings.brandLoadingText', '加载页文案')}
        name="brandLoadingText"
        extra={t(
          'admin.settings.brandLoadingText.help',
          '用于首屏静态加载和 React 接管后的页面中央加载状态。',
        )}
      >
        <Input placeholder="与 Agent 团队一起无限进步" />
      </Form.Item>
      <Form.Item
        label={t('admin.settings.brandLoadingSvgUrl', 'Loading SVG URL')}
        name="brandLoadingSvgUrl"
        extra={t(
          'admin.settings.brandLoadingSvgUrl.help',
          'Replaces the startup loading SVG. Supports an internal path or a full HTTPS URL. Leave empty to use the default loading style.',
        )}
      >
        <Input placeholder="/images/brand/loading.svg" />
      </Form.Item>
      <Form.Item
        label={t('admin.settings.brandAuthTitle', '登录页主文案')}
        name="brandAuthTitle"
        extra={t(
          'admin.settings.brandAuthTitle.help',
          '显示在登录和注册表单上方，例如 Agent teammates that grow with you。',
        )}
      >
        <Input placeholder="Agent teammates that grow with you" />
      </Form.Item>
    </Card>
  );
};

export const AssistantSettingsCard = ({
  uploadPublicUrlPrefix,
}: {
  uploadPublicUrlPrefix?: string;
}) => {
  const { t } = useTranslation('subscription');

  return (
    <Card>
      <Form.Item
        label={t('admin.settings.defaultAgentName', '助手名称')}
        name="defaultAgentName"
        extra={t(
          'admin.settings.defaultAgentName.help',
          '用于新用户默认会话、欢迎页和侧边栏中的助手名称。',
        )}
      >
        <Input placeholder="玄果助手" />
      </Form.Item>
      <Form.Item
        label={t('admin.settings.defaultAgentAvatar', '助手头像代码')}
        name="defaultAgentAvatar"
        extra={t(
          'admin.settings.defaultAgentAvatar.help',
          '支持图片 URL、站内路径或 emoji。留空时使用默认头像。',
        )}
      >
        <ImageUrlUploadInput
          placeholder={DEFAULT_COMHUB_AGENT_AVATAR}
          publicUrlPrefix={uploadPublicUrlPrefix}
        />
      </Form.Item>
      <Form.Item
        label={t('admin.settings.defaultSkillName', '默认技能名称')}
        name="defaultSkillName"
        extra={t(
          'admin.settings.defaultSkillName.help',
          '用于配置内置默认技能的显示名称；留空时使用品牌名称。',
        )}
      >
        <Input placeholder={t('admin.settings.defaultSkillName.placeholder', '玄果技能')} />
      </Form.Item>
    </Card>
  );
};

export const EntryCopySettingsCard = () => {
  const { t } = useTranslation('subscription');

  return (
    <Card>
      <Form.Item
        label={t('admin.settings.homeMessengerEnabled', '启用首页聊天平台入口')}
        name="homeMessengerEnabled"
        valuePropName="checked"
        extra={t(
          'admin.settings.homeMessengerEnabled.help',
          '关闭后首页聊天框下方不会再随机显示聊天平台入口；/settings/messenger 功能页仍保留。',
        )}
      >
        <Switch />
      </Form.Item>
      <Form.Item
        label={t('admin.settings.homeMessengerBannerTitle', '首页聊天平台文案')}
        name="homeMessengerBannerTitle"
        extra={t(
          'admin.settings.homeMessengerBannerTitle.help',
          '控制首页聊天框下方“聊天平台”入口文字，留空时使用系统默认文案。',
        )}
      >
        <Input placeholder="在你喜爱的聊天应用中，与 {{brandName}} 畅聊" />
      </Form.Item>
      <Form.Item
        label={t('admin.settings.communityForkAndChatLabel', '社区派生按钮文字')}
        name="communityForkAndChatLabel"
        extra={t(
          'admin.settings.communityForkAndChatLabel.help',
          '控制社区详情页派生按钮文字，留空时使用系统默认文案。',
        )}
      >
        <Input placeholder="派生并聊天" />
      </Form.Item>
      <Form.Item
        label={t('admin.settings.communitySkillUseButtonLabel', 'Skill 使用按钮文字')}
        name="communitySkillUseButtonLabel"
        extra={t(
          'admin.settings.communitySkillUseButtonLabel.help',
          '控制 Skill 详情页“在 LobeAI 上使用”按钮文字，留空时使用当前品牌名生成默认文案。',
        )}
      >
        <Input placeholder="在 QingyouAI 上使用" />
      </Form.Item>
      <Form.Item
        label={t('admin.settings.sidebarMemberLabel', '侧栏会员按钮名称')}
        name="sidebarMemberLabel"
        extra={t(
          'admin.settings.sidebarMemberLabel.help',
          '显示在侧栏首页下方的会员入口，留空时显示“会员”。',
        )}
      >
        <Input placeholder="会员" />
      </Form.Item>
      <Form.Item
        label={t('admin.settings.sidebarMemberUrl', '侧栏会员按钮链接')}
        name="sidebarMemberUrl"
        extra={t(
          'admin.settings.sidebarMemberUrl.help',
          '会员入口点击后打开的站内或外部链接，默认 /settings/plans。',
        )}
      >
        <Input placeholder="/settings/plans" />
      </Form.Item>
      <Form.Item
        label={t('admin.settings.sidebarGenerationLabel', '侧栏生成按钮名称')}
        name="sidebarGenerationLabel"
        extra={t(
          'admin.settings.sidebarGenerationLabel.help',
          '控制侧栏 /image 生成入口显示名称，留空时显示“生成”。',
        )}
      >
        <Input placeholder="生成" />
      </Form.Item>
    </Card>
  );
};


export default BrandSettingsCard;
