'use client';

import { Avatar, Block, Flexbox, Icon, Text } from '@lobehub/ui';
import { type ItemType } from 'antd/es/menu/interface';
import { useTheme } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { ActivityIcon, MessageSquareHeartIcon } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shallow } from 'zustand/shallow';

import Menu from '@/components/Menu';
import { DEFAULT_COMHUB_AGENT_NAME } from '@/const/defaultAgent';
import { DEFAULT_AVATAR, DEFAULT_INBOX_AVATAR } from '@/const/meta';
import { AgentSettings as Settings } from '@/features/AgentSetting';
import { useBrand } from '@/features/Brand/BrandProvider';
import { usePermission } from '@/hooks/usePermission';
import { useAgentStore } from '@/store/agent';
import { agentSelectors, builtinAgentSelectors } from '@/store/agent/selectors';
import { ChatSettingsTabs } from '@/store/global/initialState';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';

const Content = memo(() => {
  const { t } = useTranslation('setting');
  const theme = useTheme();
  const brand = useBrand();
  const { allowed: canEdit } = usePermission('edit_own_content');
  const [agentId, isInbox] = useAgentStore(
    (s) => [s.activeAgentId, builtinAgentSelectors.isInboxAgent(s)],
    shallow,
  );
  const config = useAgentStore(agentSelectors.currentAgentConfig, isEqual);
  const meta = useAgentStore(agentSelectors.currentAgentMeta, isEqual);
  const defaultAgentMeta = useUserStore(settingsSelectors.defaultAgentMeta);
  const { enableAgentSelfIteration } = useServerConfigStore(featureFlagsSelectors);
  const [tab, setTab] = useState(ChatSettingsTabs.Opening);

  const availableTabs = useMemo(
    () =>
      [
        !isInbox ? ChatSettingsTabs.Opening : null,
        enableAgentSelfIteration ? ChatSettingsTabs.SelfIteration : null,
      ].filter(Boolean) as ChatSettingsTabs[],
    [isInbox, enableAgentSelfIteration],
  );

  const activeTab = availableTabs.includes(tab) ? tab : availableTabs[0];

  useEffect(() => {
    if (activeTab && activeTab !== tab) setTab(activeTab);
  }, [activeTab, tab]);

  const updateAgentConfig = async (config: any) => {
    if (!canEdit) return;
    if (!agentId) return;
    await useAgentStore.getState().optimisticUpdateAgentConfig(agentId, config);
  };

  const updateAgentMeta = async (meta: any) => {
    if (!canEdit) return;
    if (!agentId) return;
    await useAgentStore.getState().optimisticUpdateAgentMeta(agentId, meta);
  };

  const menuItems: ItemType[] = useMemo(
    () =>
      availableTabs
        .map((tab) => {
          switch (tab) {
            case ChatSettingsTabs.Opening: {
              return {
                icon: <Icon icon={MessageSquareHeartIcon} />,
                key: ChatSettingsTabs.Opening,
                label: t('agentTab.opening'),
              };
            }
            case ChatSettingsTabs.SelfIteration: {
              return {
                icon: <Icon icon={ActivityIcon} />,
                key: ChatSettingsTabs.SelfIteration,
                label: t('agentTab.selfIteration'),
              };
            }
            default: {
              return null;
            }
          }
        })
        .filter(Boolean) as ItemType[],
    [availableTabs, t],
  );

  const displayTitle = isInbox
    ? defaultAgentMeta.title || brand.name || DEFAULT_COMHUB_AGENT_NAME
    : meta.title || t('defaultSession', { ns: 'common' });
  const displayAvatar = isInbox
    ? defaultAgentMeta.avatar || brand.logoUrl || DEFAULT_INBOX_AVATAR
    : meta.avatar || DEFAULT_AVATAR;

  return (
    <Flexbox
      direction="horizontal"
      height="100%"
      style={{
        padding: 0,
        position: 'relative',
      }}
    >
      <Flexbox
        height={'100%'}
        paddingBlock={24}
        paddingInline={8}
        width={200}
        style={{
          background: theme.colorBgLayout,
          borderRight: `1px solid ${theme.colorBorderSecondary}`,
        }}
      >
        <Block
          horizontal
          align={'center'}
          gap={8}
          paddingBlock={'14px 16px'}
          paddingInline={4}
          variant={'borderless'}
          style={{
            overflow: 'hidden',
          }}
        >
          <Avatar
            avatar={displayAvatar}
            background={meta.backgroundColor || undefined}
            shape={'square'}
            size={28}
          />
          <Text ellipsis weight={500}>
            {displayTitle}
          </Text>
        </Block>
        <Menu
          selectable
          items={menuItems}
          selectedKeys={activeTab ? [activeTab] : []}
          style={{ width: '100%' }}
          onClick={({ key }) => setTab(key as ChatSettingsTabs)}
        />
      </Flexbox>
      <Flexbox
        flex={1}
        paddingBlock={24}
        paddingInline={64}
        style={{ overflow: 'scroll', width: '100%' }}
      >
        {activeTab ? (
          <Settings
            config={config}
            disabled={!canEdit}
            id={agentId}
            loading={false}
            meta={meta}
            tab={activeTab}
            onConfigChange={updateAgentConfig}
            onMetaChange={updateAgentMeta}
          />
        ) : (
          <Flexbox align="center" flex={1} gap={8} justify="center" style={{ textAlign: 'center' }}>
            <Text weight={500}>
              {t('agentTab.empty.title', { defaultValue: '暂无可配置项' })}
            </Text>
            <Text type="secondary">
              {t('agentTab.empty.desc', { defaultValue: '默认 AI 当前没有开放的进阶配置。' })}
            </Text>
          </Flexbox>
        )}
      </Flexbox>
    </Flexbox>
  );
});

export default Content;
