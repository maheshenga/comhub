'use client';

import { Menu } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { ArrowLeft, Search } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import {
  filterAdminNavSections,
  getAdminActiveLeafKey,
  getAdminNavigationContext,
  getAdminNavSectionsForRole,
  getAdminOpenKeys,
} from './adminNavigation';
import { buildMenuItems } from './Sidebar/navigation';
import { sidebarIconSize, sidebarStyles } from './Sidebar/sidebarStyles';

const AdminSidebar = memo<{ collapsed?: boolean; onNavigate?: () => void }>(
  ({ collapsed = false, onNavigate }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation('subscription');
    const role = useUserStore((state) => (userProfileSelectors.userProfile(state) as any)?.role);
    const groups = useMemo(() => getAdminNavSectionsForRole(role), [role]);
    const context = useMemo(
      () => getAdminNavigationContext(role, location.pathname),
      [location.pathname, role],
    );
    const routeOpenKeys = useMemo(() => getAdminOpenKeys(location.pathname), [location.pathname]);
    const [openKeys, setOpenKeys] = useState<string[]>(routeOpenKeys);
    const [query, setQuery] = useState('');
    // 搜索过滤必须与界面显示值同语言：translate 取 t(key,{defaultValue})，
    // 否则 en 用户按显示的英文（如 'Module finance'）搜索时 raw 中文匹配不上，
    // 整个侧栏清空（复核发现 2）。
    const translate = useMemo(() => (key: string, fallback: string) => t(key, { defaultValue: fallback }), [t]);
    const filteredGroups = useMemo(
      () => filterAdminNavSections(groups, query, translate),
      [groups, query, translate],
    );

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
    // B8 需求 3：选中态解析到叶子（getAdminSelectedKey），再映射到子栏目代
    // 表路径——两级侧栏的 Menu item key 是子栏目代表条目，直接用叶子路径会
    // 指向不存在的 key 而无高亮。
    const selectedKey = getAdminActiveLeafKey(role, location.pathname);
    const visibleOpenKeys = query ? filteredGroups.map((group) => group.key) : openKeys;

    return (
      <div className={sidebarStyles.root}>
        {collapsed ? (
          <header aria-hidden className={sidebarStyles.brand} />
        ) : (
          <header className={sidebarStyles.brand}>
            <span className={sidebarStyles.brandTitle}>
              {t('admin.navigation.title', '管理后台')}
            </span>
            <span className={sidebarStyles.brandCaption}>
              {context
                ? t(`admin.navigation.items.${context.item.id}.description`, {
                    defaultValue: context.item.description,
                  })
                : t('admin.navigation.caption', '统一管理平台能力')}
            </span>
          </header>
        )}
        {!collapsed ? (
          <label className={sidebarStyles.searchWrap}>
            <Search aria-hidden className={sidebarStyles.searchIcon} size={sidebarIconSize} />
            <input
              aria-label={t('admin.navigation.search', '搜索管理功能')}
              className={sidebarStyles.search}
              placeholder={t('admin.navigation.searchPlaceholder', '搜索页面或功能...')}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        ) : null}
        <nav
          aria-label={t('admin.navigation.title', '管理后台')}
          className={sidebarStyles.navigation}
        >
          {filteredGroups.length > 0 ? (
            <Menu
              className={sidebarStyles.menu}
              inlineCollapsed={collapsed}
              items={items}
              mode="inline"
              openKeys={collapsed ? [] : visibleOpenKeys}
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
          {collapsed ? (
            <Button
              aria-label={t('admin.navigation.backToApp', '返回前台')}
              icon={<ArrowLeft aria-hidden size={sidebarIconSize} />}
              onClick={() => {
                navigate('/');
                onNavigate?.();
              }}
            />
          ) : (
            <Button
              className={sidebarStyles.footerButton}
              onClick={() => {
                navigate('/');
                onNavigate?.();
              }}
            >
              <ArrowLeft aria-hidden size={sidebarIconSize} />
              {t('admin.navigation.backToApp', '返回前台')}
            </Button>
          )}
        </footer>
      </div>
    );
  },
);

AdminSidebar.displayName = 'AdminSidebar';

export default AdminSidebar;
