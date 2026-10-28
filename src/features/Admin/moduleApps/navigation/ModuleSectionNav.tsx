'use client';

import { createStaticStyles } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import {
  MODULE_ADMIN_ROUTE_PATHS,
  type ModuleAdminRouteId,
  type ModuleAdminSection,
} from './catalog';
import { getModuleAppSectionsForRole } from './policy';
import { getModuleSectionStatus } from './sectionStatus';

/**
 * B8b：本组件收窄为应用详情页的页签导航（mode=center 的模块中心二级树形侧栏
 * 已随 ModuleCenterLayout 下线）。分区级导航（角色过滤 / 状态徽标 / 空组抑
 * 制）由后台主侧栏的两级结构接管（adminNavigation.ts 的
 * getAdminNavSectionsForRole / SUB_SECTION_STATUS_OVERRIDES）。
 */
const styles = createStaticStyles(({ css, cssVar }) => ({
  link: css`
    display: flex;
    align-items: center;

    min-height: 36px;
    padding-block: 7px;
    padding-inline: 10px;
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 14px;
    line-height: 22px;
    color: ${cssVar.colorTextSecondary};
    text-decoration: none;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }

    &[aria-current='page'] {
      font-weight: 600;
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  statusBadge: css`
    display: inline-flex;
    flex: none;
    align-items: center;

    margin-inline-start: auto;
    padding-block: 1px;
    padding-inline: 6px;
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 11px;
    line-height: 16px;
    color: ${cssVar.colorTextTertiary};

    background: ${cssVar.colorFillTertiary};

    &[data-status='experimental'] {
      color: ${cssVar.colorWarning};
      background: ${cssVar.colorWarningBg};
    }

    &[data-status='compatibility'] {
      color: ${cssVar.colorTextSecondary};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  nav: css`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    width: 100%;
  `,
}));

const DETAIL_LABEL_KEYS: Partial<Record<ModuleAdminRouteId, string>> = {
  'module-app-configuration': 'configuration',
  'module-app-entitlements': 'entitlements',
  'module-app-overview': 'overview',
  'module-app-products': 'products',
  'module-app-runtime': 'runtime',
};

export interface ModuleSectionNavProps {
  appId?: string;
  role?: null | string;
}

const resolveDetailPath = (path: string, appId?: string) =>
  appId ? path.replace(':appId', encodeURIComponent(appId)) : path;

const ModuleSectionNav = memo<ModuleSectionNavProps>(({ appId, role }) => {
  const { t } = useTranslation('common');
  const translate = (key: string) => t(key as any);
  const profileRole = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const resolvedRole = role ?? profileRole;
  const sections = getModuleAppSectionsForRole(resolvedRole);

  // PP-10：分区状态徽标（experimental/compatibility 显式标注）。
  const statusBadge = (id: ModuleAdminRouteId) => {
    const status = getModuleSectionStatus(id);
    if (status === 'active') return null;
    return (
      <span
        aria-hidden
        className={styles.statusBadge}
        data-status={status}
        title={
          status === 'experimental'
            ? translate('moduleApps.admin.center.sectionStatus.experimental')
            : translate('moduleApps.admin.center.sectionStatus.compatibility')
        }
      >
        {status === 'experimental'
          ? translate('moduleApps.admin.center.sectionStatus.experimental')
          : translate('moduleApps.admin.center.sectionStatus.compatibility')}
      </span>
    );
  };

  const renderLink = (section: ModuleAdminSection) => {
    const labelKey = DETAIL_LABEL_KEYS[section.id];
    if (!labelKey) return null;

    return (
      <NavLink
        end
        className={styles.link}
        key={section.id}
        title={translate(`moduleApps.admin.center.sectionDescriptions.${labelKey}`)}
        to={resolveDetailPath(MODULE_ADMIN_ROUTE_PATHS[section.id], appId)}
      >
        {translate(`moduleApps.admin.center.detailNavigation.${labelKey}`)}
        {/* PP-10：非 active 分区显式标注真实状态，避免「看起来是主路径」的误导。 */}
        {statusBadge(section.id)}
      </NavLink>
    );
  };

  return (
    <nav
      aria-label={translate('moduleApps.admin.center.detailNavigation.label')}
      className={styles.nav}
    >
      {sections.map((section) => renderLink(section))}
    </nav>
  );
});

ModuleSectionNav.displayName = 'ModuleSectionNav';

export default ModuleSectionNav;
