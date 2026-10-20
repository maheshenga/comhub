'use client';

import { Select, Text } from '@lobehub/ui';

import AdminDangerousActionButton from '../AdminDangerousActionButton';
import type { buildAdminDangerousActionEnvelope } from '../adminDangerousActions';
import type { BuildProfileView } from './BuildProfilePage';
import { desktopControlCenterStyles } from './styles';

/** 构建配置档案头部（选择器 + 归档按钮，M5 拆页抽出）。 */
export const BuildProfileHeader = ({
  archiving,
  isLocalProfile,
  localProfile,
  onArchive,
  onSelect,
  profileItems,
  selectedProfileId,
  t,
}: {
  archiving: boolean;
  isLocalProfile: boolean;
  localProfile?: BuildProfileView;
  onArchive: (
    envelope: ReturnType<typeof buildAdminDangerousActionEnvelope<'desktop.buildProfile.archive'>>,
  ) => void;
  onSelect: (profileId: string) => void;
  profileItems: BuildProfileView[];
  selectedProfileId: string;
  t: (key: any, defaultValue?: any, values?: any) => any;
}) => (
  <div className={desktopControlCenterStyles.buildProfileHeader}>
    <div>
      <Text as={'h4'} className={desktopControlCenterStyles.sectionTitle}>
        {t('admin.desktopControl.tabs.buildProfile')}
      </Text>
      <Text type="secondary">{t('admin.desktopBuild.subtitle')}</Text>
    </div>
    <div className={desktopControlCenterStyles.buildProfileActions}>
      <label
        className={desktopControlCenterStyles.buildProfileSelectorLabel}
        htmlFor="desktop-build-profile-selector"
      >
        {t('admin.desktopBuild.profile.selector')}
      </label>
      <Select
        id="desktop-build-profile-selector"
        style={{ minWidth: 180 }}
        value={selectedProfileId}
        options={[...(isLocalProfile && localProfile ? [localProfile] : []), ...profileItems].map(
          (profile) => ({ label: profile.name, value: profile.id }),
        )}
        onChange={(profileId) => void onSelect(profileId)}
      />
      {!isLocalProfile ? (
        <AdminDangerousActionButton
          danger
          actionId="desktop.buildProfile.archive"
          loading={archiving}
          onConfirm={(envelope) => onArchive(envelope)}
        >
          {t('admin.desktopBuild.profile.archive')}
        </AdminDangerousActionButton>
      ) : null}
    </div>
  </div>
);
