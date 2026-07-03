'use client';

import { ActionIcon, Avatar, Block, Text } from '@lobehub/ui';
import { ChevronsUpDownIcon } from 'lucide-react';
import { type PropsWithChildren } from 'react';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_COMHUB_AGENT_NAME } from '@/const/defaultAgent';
import { DESKTOP_HEADER_ICON_SMALL_SIZE } from '@/const/layoutTokens';
import { DEFAULT_AVATAR, DEFAULT_INBOX_AVATAR } from '@/const/meta';
import { SkeletonItem } from '@/features/NavPanel/components/SkeletonList';
import { useAgentStore } from '@/store/agent';
import { agentSelectors, builtinAgentSelectors } from '@/store/agent/selectors';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';

import SwitchPanel from './SwitchPanel';

const Agent = memo<PropsWithChildren>(() => {
  const { t } = useTranslation(['chat', 'common']);

  const [isLoading, isInbox, title, avatar, backgroundColor] = useAgentStore((s) => [
    agentSelectors.isAgentConfigLoading(s),
    builtinAgentSelectors.isInboxAgent(s),
    agentSelectors.currentAgentTitle(s),
    agentSelectors.currentAgentAvatar(s),
    agentSelectors.currentAgentBackgroundColor(s),
  ]);
  const defaultAgentMeta = useUserStore(settingsSelectors.defaultAgentMeta);

  const displayTitle = isInbox
    ? title || defaultAgentMeta.title || DEFAULT_COMHUB_AGENT_NAME
    : title || t('defaultSession', { ns: 'common' });

  if (isLoading) return <SkeletonItem height={32} padding={0} />;

  return (
    <SwitchPanel>
      <Block
        clickable
        horizontal
        align={'center'}
        gap={8}
        padding={2}
        variant={'borderless'}
        style={{
          minWidth: 32,
          overflow: 'hidden',
        }}
      >
        <Avatar
          background={backgroundColor || undefined}
          shape={'square'}
          size={28}
          avatar={
            isInbox
              ? avatar && avatar !== DEFAULT_INBOX_AVATAR
                ? avatar
                : defaultAgentMeta.avatar || DEFAULT_INBOX_AVATAR
              : avatar || DEFAULT_AVATAR
          }
        />
        <Text ellipsis weight={500}>
          {displayTitle}
        </Text>
        <ActionIcon
          icon={ChevronsUpDownIcon}
          size={DESKTOP_HEADER_ICON_SMALL_SIZE}
          style={{
            width: 24,
          }}
        />
      </Block>
    </SwitchPanel>
  );
});

export default Agent;
