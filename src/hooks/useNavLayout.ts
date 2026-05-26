import { CrownIcon, HomeIcon, SearchIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getRouteById } from '@/config/routes';
import { PUBLIC_EXPERT_PLAZA_SWR_KEY } from '@/const/adminCacheKeys';
import { DEFAULT_EXPERT_PLAZA_CONFIG } from '@/const/expertPlaza';
import { useBrand } from '@/features/Brand';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useGlobalStore } from '@/store/global';
import { SidebarTabKey } from '@/store/global/initialState';
import {
  featureFlagsSelectors,
  serverConfigSelectors,
  useServerConfigStore,
} from '@/store/serverConfig';

export interface NavItem {
  hidden?: boolean;
  icon: any;
  isNew?: boolean;
  key: string;
  onClick?: () => void;
  title: string;
  url?: string;
}

export interface NavLayout {
  bottomMenuItems: NavItem[];
  footer: {
    hideGitHub: boolean;
    layout: 'expanded' | 'compact';
    showEvalEntry: boolean;
    showSettingsEntry: boolean;
  };
  topNavItems: NavItem[];
  userPanel: {
    showDataImporter: boolean;
    showMemory: boolean;
  };
}

export const useNavLayout = (): NavLayout => {
  const { t } = useTranslation('common');
  const brand = useBrand();
  const toggleCommandMenu = useGlobalStore((s) => s.toggleCommandMenu);
  const { showMarket, hideGitHub } = useServerConfigStore(featureFlagsSelectors);
  const enableBusinessFeatures = useServerConfigStore(serverConfigSelectors.enableBusinessFeatures);
  const { data: expertPlazaConfig } = useClientDataSWR(
    enableBusinessFeatures ? PUBLIC_EXPERT_PLAZA_SWR_KEY : null,
    () => adminCommercialService.getPublicExpertPlaza(),
    { revalidateOnFocus: false },
  );
  const expertPlaza = expertPlazaConfig ?? DEFAULT_EXPERT_PLAZA_CONFIG;

  const topNavItems = useMemo(
    () =>
      [
        {
          icon: HomeIcon,
          key: SidebarTabKey.Home,
          title: t('tab.home'),
          url: '/',
        },
        {
          icon: CrownIcon,
          key: SidebarTabKey.Member,
          title: brand.sidebarMemberLabel || '会员',
          url: brand.sidebarMemberUrl || '/settings/plans',
        },
        {
          icon: SearchIcon,
          key: 'search',
          onClick: () => toggleCommandMenu(true),
          title: t('tab.search'),
        },
        {
          icon: getRouteById('tasks')!.icon,
          key: SidebarTabKey.Tasks,
          title: t('tab.tasks'),
          url: '/tasks',
        },
        {
          icon: getRouteById('page')!.icon,
          key: SidebarTabKey.Pages,
          title: t('tab.pages'),
          url: '/page',
        },
      ] as NavItem[],
    [brand.sidebarMemberLabel, brand.sidebarMemberUrl, t, toggleCommandMenu],
  );

  const bottomMenuItems = useMemo(
    () =>
      [
        {
          icon: getRouteById('image')!.icon,
          key: SidebarTabKey.Image,
          title: brand.sidebarGenerationLabel || t('tab.generation'),
          url: '/image',
        },
        {
          icon: getRouteById('ppt')!.icon,
          key: SidebarTabKey.Ppt,
          title: t('tab.ppt'),
          url: '/ppt',
        },
        {
          hidden: !showMarket,
          icon: getRouteById('community')!.icon,
          key: SidebarTabKey.Community,
          title: t('tab.community'),
          url: '/community',
        },
        {
          hidden: !enableBusinessFeatures || !expertPlaza.enabled,
          icon: getRouteById('experts')!.icon,
          key: SidebarTabKey.Experts,
          title: expertPlaza.name || t('tab.experts'),
          url: '/experts',
        },
        {
          icon: getRouteById('resource')!.icon,
          key: SidebarTabKey.Resource,
          title: t('tab.resource'),
          url: '/resource',
        },
        {
          icon: getRouteById('memory')!.icon,
          key: SidebarTabKey.Memory,
          title: t('tab.memory'),
          url: '/memory',
        },
      ] as NavItem[],
    [
      brand.sidebarGenerationLabel,
      t,
      showMarket,
      enableBusinessFeatures,
      expertPlaza.enabled,
      expertPlaza.name,
    ],
  );

  const footer = useMemo(
    () => ({
      hideGitHub: !!hideGitHub,
      layout: 'compact' as const,
      showEvalEntry: false,
      showSettingsEntry: true,
    }),
    [hideGitHub],
  );

  const userPanel = useMemo(
    () => ({
      showDataImporter: false,
      showMemory: true,
    }),
    [],
  );

  return { bottomMenuItems, footer, topNavItems, userPanel };
};
