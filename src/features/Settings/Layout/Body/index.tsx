'use client';

import { Accordion, Flexbox, Text } from '@lobehub/ui';
import { memo, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import NavItem from '@/features/NavPanel/components/NavItem';
import { getTabUrl, SearchSection } from '@/features/SettingsSearch';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { useActiveLocation } from '@/hooks/useActiveLocation';
import { SettingsTabs } from '@/store/global/initialState';
import { isModifierClick } from '@/utils/navigation';

import { SettingsGroupKey, useCategory } from '../../hooks/useCategory';

/** 当前 tab 所属的分组；找不到时兜底为 Account。 */
const getActiveGroupKey = (
  groups: { items: { key: SettingsTabs }[]; key: SettingsGroupKey }[],
  activeTab: SettingsTabs,
): SettingsGroupKey =>
  groups.find((group) => group.items.some((item) => item.key === activeTab))?.key ??
  SettingsGroupKey.Account;

const Body = memo(() => {
  const categoryGroups = useCategory();
  const navigate = useWorkspaceAwareNavigate();
  const location = useActiveLocation();

  // Extract current tab from pathname: /settings/profile -> profile
  const activeTab = useMemo(() => {
    const pathParts = location.pathname.split('/');
    // pathname is like /settings/profile or /settings/provider/xxx
    if (pathParts.length >= 3) {
      return pathParts[2] as SettingsTabs;
    }
    return SettingsTabs.Profile;
  }, [location.pathname]);

  // 只展开当前 tab 所在分组。此前 defaultValue 硬编码 6 个分组全开且与
  // activeTab 无联动：首屏把 23~33 行条目全铺出来，要滚动才能定位当前页，
  // 且离开 /settings 再回来折叠状态被重置。按 Admin 侧栏（AdminSidebar +
  // getAdminOpenKeys）已验证的受控写法对齐。
  //
  // effect 的依赖刻意是 `activeGroupKey`（字符串标量）而不是 routeOpenKeys /
  // categoryGroups（数组引用）：useCategory 虽自身 useMemo 稳定，但它返回的
  // 引用稳定性不是它的契约——任何未 memo 的实现或测试 mock（activeTab.desktop
  // .test.ts 就每次调用返回新字面量）都会让数组引用每渲染都变，而
  // setOpenKeys 每次都写入新数组，于是形成 setState → 重渲染 → 依赖变 → 再
  // setState 的死循环（实测 worker 以 exit code 134 崩掉，不是断言失败）。
  const activeGroupKey = useMemo(
    () => getActiveGroupKey(categoryGroups, activeTab),
    [activeTab, categoryGroups],
  );
  const [openKeys, setOpenKeys] = useState<string[]>([activeGroupKey]);

  useEffect(() => setOpenKeys([activeGroupKey]), [activeGroupKey]);

  return (
    <Flexbox gap={4} paddingInline={4}>
      <SearchSection>
        <Accordion
          gap={8}
          indicatorPlacement="inline"
          styles={{ trigger: { paddingBlock: 4, paddingInline: '8px 4px' } }}
          value={openKeys}
          items={categoryGroups.map((group) => ({
            key: group.key,
            title: (
              <Text ellipsis fontSize={12} type={'secondary'} weight={500}>
                {group.title}
              </Text>
            ),
            children: (
              <Flexbox gap={1} paddingBlock={1}>
                {group.items.map((item) => {
                  const url = item.href ?? getTabUrl(item.key);
                  return (
                    <Link
                      key={item.key}
                      to={url}
                      onClick={(e) => {
                        if (isModifierClick(e)) return;
                        e.preventDefault();
                        navigate(url);
                      }}
                    >
                      <NavItem
                        active={activeTab === item.key}
                        icon={item.icon}
                        title={item.label}
                      />
                    </Link>
                  );
                })}
              </Flexbox>
            ),
          }))}
          onValueChange={(next) => setOpenKeys(next as string[])}
        />
      </SearchSection>
    </Flexbox>
  );
});

export default Body;
