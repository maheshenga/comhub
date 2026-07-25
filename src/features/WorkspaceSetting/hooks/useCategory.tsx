import { SkillsIcon } from '@lobehub/ui/icons';
import {
  AppWindowIcon,
  Blocks,
  Brain,
  ChartColumnBigIcon,
  Database,
  KeyIcon,
  KeyRound,
  MonitorSmartphoneIcon,
  Sparkles,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsWorkspaceOwner } from '@/business/client/hooks/useIsWorkspaceOwner';
import { useUserStore } from '@/store/user';
import { labPreferSelectors } from '@/store/user/selectors';
import { WorkspaceSettingsTabs } from '@/types/workspaceSettings';

export enum WorkspaceSettingsGroupKey {
  Admin = 'admin',
  Agent = 'agent',
  Developer = 'developer',
  General = 'general',
  Subscription = 'subscription',
}

export interface WorkspaceSettingCategoryItem {
  icon: any;
  key: WorkspaceSettingsTabs;
  label: string;
}

export interface WorkspaceSettingCategoryGroup {
  items: WorkspaceSettingCategoryItem[];
  key: WorkspaceSettingsGroupKey;
  title: string;
}

export const useWorkspaceSettingCategory = (): WorkspaceSettingCategoryGroup[] => {
  const { t } = useTranslation('setting');
  const { t: tAuth } = useTranslation('auth');
  const isOwner = useIsWorkspaceOwner();
  const enableOAuthApps = useUserStore(labPreferSelectors.enableOAuthApps);

  return useMemo(
    () =>
      [
        {
          items: [
            {
              icon: MonitorSmartphoneIcon,
              key: WorkspaceSettingsTabs.Devices,
              label: t('tab.devices'),
            },
            {
              icon: ChartColumnBigIcon,
              key: WorkspaceSettingsTabs.Stats,
              label: tAuth('tab.stats'),
            },
          ],
          key: WorkspaceSettingsGroupKey.General,
          title: t('workspaceSetting.group.general'),
        },
        {
          items: [
            // AI provider config (keys/endpoints) is shared workspace infra —
            // owner-only, hidden from members entirely (LOBE-11834).
            isOwner && {
              icon: Brain,
              key: WorkspaceSettingsTabs.Provider,
              label: t('tab.provider'),
            },
            {
              icon: Sparkles,
              key: WorkspaceSettingsTabs.ServiceModel,
              label: t('tab.serviceModel'),
            },
            {
              icon: SkillsIcon,
              key: WorkspaceSettingsTabs.Skill,
              label: t('workspaceSetting.tab.skill'),
            },
            {
              icon: Blocks,
              key: WorkspaceSettingsTabs.Connector,
              label: t('workspaceSetting.tab.connector'),
            },
            {
              icon: KeyRound,
              key: WorkspaceSettingsTabs.Creds,
              label: t('tab.creds'),
            },
            // Messenger (chat platform) is intentionally omitted from workspace
            // settings: the System Bot binding is a per-user/personal identity
            // (the link is owned by `userId`, not the workspace), and reaching a
            // workspace's agents happens via the scope selector on the *personal*
            // Messenger page. There is nothing workspace-level to configure here.
          ].filter(Boolean) as WorkspaceSettingCategoryItem[],
          key: WorkspaceSettingsGroupKey.Agent,
          title: t('workspaceSetting.group.agent'),
        },
        enableOAuthApps && {
          items: [
            {
              icon: AppWindowIcon,
              key: WorkspaceSettingsTabs.OAuthApps,
              label: tAuth('tab.oauthApps'),
            },
          ],
          key: WorkspaceSettingsGroupKey.Developer,
          title: t('group.developer'),
        },
        // The Admin group is owner-only — managing shared infra and audit
        // surfaces is an owner action.
        isOwner && {
          items: [
            {
              icon: Database,
              key: WorkspaceSettingsTabs.Storage,
              label: t('tab.storage'),
            },
            {
              icon: KeyIcon,
              key: WorkspaceSettingsTabs.APIKey,
              label: tAuth('tab.apikey'),
            },
          ].filter(Boolean) as WorkspaceSettingCategoryItem[],
          key: WorkspaceSettingsGroupKey.Admin,
          title: t('workspaceSetting.group.admin'),
        },
      ].filter(Boolean) as WorkspaceSettingCategoryGroup[],
    [t, tAuth, enableOAuthApps, isOwner],
  );
};
