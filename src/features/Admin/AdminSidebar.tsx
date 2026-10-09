'use client';

import { Button } from '@lobehub/ui/base-ui';
import { Menu } from 'antd';
import {
  ArrowLeft,
  Search,
} from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { filterAdminNavGroups,
  getAdminNavGroupsForRole,
  getAdminNavigationContext,
  getAdminOpenKeys,
  getAdminSelectedKey,
} from './adminNavigation';
import { buildMenuItems } from './Sidebar/navigation';
import { sidebarStyles } from './Sidebar/sidebarStyles';



const AdminSidebar = memo<{ onNavigate?: () => void }>(({ onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('subscription');
  const role = useUserStore((state) => (userProfileSelectors.userProfile(state) as any)?.role);
  const groups = useMemo(() => getAdminNavGroupsForRole(role), [role]);
  const context = useMemo(
    () => getAdminNavigationContext(role, location.pathname),
    [location.pathname, role],
  );
  const routeOpenKeys = useMemo(() => getAdminOpenKeys(location.pathname), [location.pathname]);
  const [openKeys, setOpenKeys] = useState<string[]>(routeOpenKeys);
  const [query, setQuery] = useState('');
  const filteredGroups = useMemo(() => filterAdminNavGroups(groups, query), [groups, query]);

  useEffect(() => setOpenKeys(routeOpenKeys), [routeOpenKeys]);

  const items = useMemo(
    () =>
      buildMenuItems(
        filteredGroups,
        {
          deprecated: t('admin.navigation.status.deprecated'),
          experimental: t('admin.navigation.status.experimental'),
          planned: t('admin.navigation.status.planned'),
        },
        (key, fallback) => t(key, { defaultValue: fallback }),
      ),
    [filteredGroups, t],
  );
  const selectedKey = getAdminSelectedKey(location.pathname);
  const visibleOpenKeys = query ? filteredGroups.map((group) => group.key) : openKeys;

  return (
    <div className={sidebarStyles.root}>
      <header className={sidebarStyles.brand}>
        <span className={sidebarStyles.brandTitle}>{t('admin.navigation.title', '管理后台')}</span>
        <span className={sidebarStyles.brandCaption}>
          {context
            ? t(`admin.navigation.items.${context.item.id}.description`, {
                defaultValue: context.item.description,
              })
            : t('admin.navigation.caption', '统一管理平台能力')}
        </span>
      </header>
      <label className={sidebarStyles.searchWrap}>
        <Search aria-hidden className={sidebarStyles.searchIcon} size={16} />
        <input
          aria-label={t('admin.navigation.search', '搜索管理功能')}
          className={sidebarStyles.search}
          placeholder={t('admin.navigation.searchPlaceholder', '搜索页面或功能...')}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <nav aria-label={t('admin.navigation.title', '管理后台')} className={sidebarStyles.navigation}>
        {filteredGroups.length > 0 ? (
          <Menu
            className={sidebarStyles.menu}
            items={items}
            mode="inline"
            openKeys={visibleOpenKeys}
            selectedKeys={[selectedKey]}
            onClick={({ key }: { key: string }) => {
              navigate(key);
              onNavigate?.();
            }}
            onOpenChange={(keys) => {
              if (!query) setOpenKeys(keys as string[]);
            }}
          />
        ) : (
          <div className={sidebarStyles.empty}>
            {t('admin.navigation.noResults', '未找到匹配的管理功能')}
          </div>
        )}
      </nav>
      <footer className={sidebarStyles.footer}>
        <Button
          className={sidebarStyles.footerButton}
          onClick={() => {
            navigate('/');
            onNavigate?.();
          }}
        >
          <ArrowLeft aria-hidden size={16} />
          {t('admin.navigation.backToApp', '返回前台')}
        </Button>
      </footer>
    </div>
  );
});

AdminSidebar.displayName = 'AdminSidebar';

export default AdminSidebar;
