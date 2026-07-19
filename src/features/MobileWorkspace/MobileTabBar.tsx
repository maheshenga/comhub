'use client';

import { Icon } from '@lobehub/ui';
import { TabBar, type TabBarProps } from '@lobehub/ui/mobile';
import { createStaticStyles } from 'antd-style';
import {
  Bell,
  Bot,
  Boxes,
  ChartNoAxesColumnIncreasing,
  Coins,
  Compass,
  FileText,
  Image,
  Library,
  ListTodo,
  type LucideIcon,
  MessageSquareMore,
  Palette,
  Pin,
  Plus,
  Presentation,
  Search,
  Settings,
  Shapes,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';
import { memo, useMemo } from 'react';
import { useLocation } from 'react-router';

import { MOBILE_TABBAR_HEIGHT } from '@/const/layoutTokens';
import type { MOBILE_ICON_NAMES } from '@/const/mobileConfig';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';

import { resolveMobileActiveSlot, shouldShowMobileTabBar } from './navigation';
import { useMobileConfig } from './useMobileConfig';

const styles = createStaticStyles(({ css, cssVar }) => ({
  active: css`
    svg {
      fill: color-mix(in srgb, ${cssVar.colorPrimary} 24%, transparent);
    }
  `,
  container: css`
    position: fixed;
    z-index: 100;
    inset-block-end: 0;
    inset-inline: 0;
    padding-block-end: env(safe-area-inset-bottom);
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
}));

const iconMap: Record<(typeof MOBILE_ICON_NAMES)[number], LucideIcon> = {
  'bell': Bell,
  'bot': Bot,
  'boxes': Boxes,
  'chart-no-axes-column-increasing': ChartNoAxesColumnIncreasing,
  'coins': Coins,
  'compass': Compass,
  'file-text': FileText,
  'image': Image,
  'library': Library,
  'list-todo': ListTodo,
  'message-square-more': MessageSquareMore,
  'palette': Palette,
  'pin': Pin,
  'plus': Plus,
  'presentation': Presentation,
  'search': Search,
  'settings': Settings,
  'shapes': Shapes,
  'sparkles': Sparkles,
  'store': Store,
  'users': Users,
};

const MobileTabBar = memo(() => {
  const { config } = useMobileConfig();
  const { pathname } = useLocation();
  const navigate = useWorkspaceAwareNavigate();
  const items: TabBarProps['items'] = useMemo(
    () =>
      config.navigation.items
        .filter((item) => item.visible)
        .sort((left, right) => left.order - right.order)
        .map((item) => {
          const MobileIcon = iconMap[item.icon as keyof typeof iconMap] ?? Shapes;
          return {
            icon: (active: boolean) => (
              <Icon className={active ? styles.active : undefined} icon={MobileIcon} />
            ),
            key: item.id,
            onClick: () => navigate(item.path, { escape: true }),
            title: item.label,
          };
        }),
    [config.navigation.items, navigate],
  );

  if (!shouldShowMobileTabBar(pathname, config)) return null;

  return (
    <TabBar
      activeKey={resolveMobileActiveSlot(pathname, config)}
      aria-label="Mobile workspace"
      className={styles.container}
      height={MOBILE_TABBAR_HEIGHT}
      items={items}
    />
  );
});

MobileTabBar.displayName = 'MobileTabBar';

export default MobileTabBar;
