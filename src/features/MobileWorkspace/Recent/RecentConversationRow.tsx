'use client';

import { type MenuProps } from '@lobehub/ui';
import { ActionIcon, DropdownMenu, Flexbox, Icon } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { Bot, MoreHorizontal, Pin, PinOff, Users } from 'lucide-react';
import { memo, useMemo } from 'react';

import type { MobileRecentConversation } from './recentItems';

const styles = createStaticStyles(({ css, cssVar }) => ({
  avatar: css`
    display: grid;
    flex: 0 0 40px;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillSecondary};
  `,
  badge: css`
    padding-block: 1px;
    padding-inline: 5px;
    border-radius: 4px;
    font-size: 11px;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillSecondary};
  `,
  content: css`
    min-width: 0;
    text-align: start;
  `,
  main: css`
    cursor: pointer;
    display: flex;
    flex: 1;
    gap: 12px;
    align-items: center;
    min-width: 0;
    padding: 0;
    border: none;
    color: inherit;
    background: transparent;
  `,
  meta: css`
    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
  `,
  row: css`
    display: flex;
    gap: 8px;
    align-items: center;
    min-height: 64px;
    padding-block: 8px;
    padding-inline: 12px 8px;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
  `,
  title: css`
    overflow: hidden;
    font-size: 14px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

interface RecentConversationRowProps {
  item: MobileRecentConversation;
  onOpen: () => void;
  onTogglePin: () => void;
}

const RecentConversationRow = memo<RecentConversationRowProps>(({ item, onOpen, onTogglePin }) => {
  const isGroup = item.kind === 'group' || item.kind === 'group-topic';
  const menuItems = useMemo<MenuProps['items']>(
    () => [
      {
        icon: <Icon icon={item.pinned ? PinOff : Pin} />,
        key: 'pin',
        label: item.pinned ? 'Unpin' : 'Pin',
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          onTogglePin();
        },
      },
    ],
    [item.pinned, onTogglePin],
  );

  return (
    <div className={styles.row} data-kind={item.kind} data-testid="recent-conversation-row">
      <button
        aria-label={`Open ${item.title}`}
        className={styles.main}
        type="button"
        onClick={onOpen}
      >
        <div className={styles.avatar}>
          <Icon icon={isGroup ? Users : Bot} size={20} />
        </div>
        <Flexbox className={styles.content} gap={4}>
          <div className={styles.title}>{item.title}</div>
          <Flexbox horizontal align="center" gap={6}>
            {isGroup ? <span className={styles.badge}>Group</span> : null}
            <span className={styles.meta}>
              {item.updatedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </span>
          </Flexbox>
        </Flexbox>
      </button>
      <DropdownMenu items={menuItems}>
        <ActionIcon
          aria-label={`More actions for ${item.title}`}
          icon={MoreHorizontal}
          title={`More actions for ${item.title}`}
          onClick={(event) => event.stopPropagation()}
        />
      </DropdownMenu>
    </div>
  );
});

RecentConversationRow.displayName = 'RecentConversationRow';

export default RecentConversationRow;
