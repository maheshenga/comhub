'use client';

import type { DesktopBuildAsset, DesktopBuildAssetKind } from '@lobechat/types';
import { Alert, Button, Form, Select, Skeleton, Typography, message } from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import BuildProfileEditor from './BuildProfileEditor';
import CreateDesktopReleaseModal from './CreateDesktopReleaseModal';
import DesktopBuildHistory from './DesktopBuildHistory';
import {
  type BuildProfileFormValues,
  buildProfileFormFromProfile,
  buildProfilePayloadFromForm,
  hasCompleteWindowsAssets,
} from './buildProfileForm';
import { desktopControlCenterStyles } from './styles';

const getProfileItems = (data: unknown): any[] => ((data as any)?.items ?? []) as any[];

const BuildProfilePage = memo(() => {
  const { t } = useTranslation('subscription');
  const [form] = Form.useForm<BuildProfileFormValues>();
  const profiles = useClientDataSWR(['admin-desktop-build-profiles'], () =>
    adminCommercialService.listBuildProfiles({ limit: 50 }),
  );
  const profileItems = getProfileItems(profiles.data);
  const [selectedProfileId, setSelectedProfileId] = useState<string>();
  const selectedProfile = useMemo(
    () => profileItems.find((profile) => profile.id === selectedProfileId) ?? profileItems[0],
    [profileItems, selectedProfileId],
  );
  const [assets, setAssets] = useState<Partial<Record<DesktopBuildAssetKind, DesktopBuildAsset>>>(
    {},
  );
  const [savedAssets, setSavedAssets] = useState<
    Partial<Record<DesktopBuildAssetKind, DesktopBuildAsset>>
  >({});
  const [savedFormValues, setSavedFormValues] = useState<BuildProfileFormValues>();
  const [saving, setSaving] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const releases = useClientDataSWR(['admin-desktop-releases', selectedProfile?.id], () =>
    selectedProfile?.id
      ? adminCommercialService.listDesktopReleases({ limit: 25, profileId: selectedProfile.id })
      : Promise.resolve([]),
  );

  useEffect(() => {
    if (!selectedProfile) return;
    setSelectedProfileId((current) => current ?? selectedProfile.id);
    const profileFormValues = buildProfileFormFromProfile(selectedProfile);
    form.setFieldsValue(profileFormValues);
    setAssets(selectedProfile.currentDraft?.assetManifest ?? {});
    setSavedAssets(selectedProfile.currentDraft?.assetManifest ?? {});
    setSavedFormValues(profileFormValues);
  }, [form, selectedProfile]);

  if (profiles.error) {
    return (
      <Alert
        action={
          <Button onClick={() => void profiles.mutate()}>{t('admin.desktopControl.retry')}</Button>
        }
        message={t('admin.desktopBuild.loadFailed')}
        type="error"
      />
    );
  }

  if (profiles.isLoading && !profiles.data) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (!selectedProfile) return <Alert message={t('admin.desktopBuild.empty')} type="info" />;

  const canCreateBuild = hasCompleteWindowsAssets(savedAssets);
  const canSaveDraft = hasCompleteWindowsAssets(assets);

  const handleSaveDraft = async () => {
    const payload = buildProfilePayloadFromForm(await form.validateFields());
    setSaving(true);
    try {
      await adminCommercialService.saveBuildProfileDraft({
        assets: assets as any,
        name: payload.applicationName,
        payload,
        profileId: selectedProfile.id,
      });
      setSavedAssets(assets);
      setSavedFormValues(payload);
      await profiles.mutate();
      message.success(t('admin.desktopBuild.saveSuccess'));
    } catch {
      message.error(t('admin.desktopBuild.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const archiveProfile = async () => {
    await adminCommercialService.archiveBuildProfile(selectedProfile.id);
    await profiles.mutate();
  };

  return (
    <div className={desktopControlCenterStyles.buildProfileLayout}>
      <div className={desktopControlCenterStyles.buildProfileHeader}>
        <div>
          <Typography.Title className={desktopControlCenterStyles.sectionTitle} level={4}>
            {t('admin.desktopControl.tabs.buildProfile')}
          </Typography.Title>
          <Typography.Text type="secondary">{t('admin.desktopBuild.subtitle')}</Typography.Text>
        </div>
        <div className={desktopControlCenterStyles.buildProfileActions}>
          <Select
            aria-label={t('admin.desktopBuild.profile.selector')}
            id="desktop-build-profile-selector"
            options={profileItems.map((profile) => ({ label: profile.name, value: profile.id }))}
            style={{ minWidth: 180 }}
            value={selectedProfile.id}
            onChange={setSelectedProfileId}
          />
          <Button onClick={() => void archiveProfile()}>
            {t('admin.desktopBuild.profile.archive')}
          </Button>
        </div>
      </div>
      <Alert
        description={t('admin.desktopBuild.publisher.description')}
        message={t('admin.desktopBuild.publisher.notice')}
        showIcon
        type="info"
      />
      <BuildProfileEditor
        assets={assets}
        form={form}
        identityLocked={selectedProfile.identityLocked}
        profileId={selectedProfile.id}
        onAssetUploaded={(kind, asset) => setAssets((current) => ({ ...current, [kind]: asset }))}
      />
      <div className={desktopControlCenterStyles.formActions}>
        <Button disabled={!canSaveDraft} loading={saving} onClick={() => void handleSaveDraft()}>
          {t('admin.desktopBuild.saveDraft')}
        </Button>
        <Button disabled={!canCreateBuild} type="primary" onClick={() => setReleaseOpen(true)}>
          {t('admin.desktopBuild.createBuild')}
        </Button>
      </div>
      {!canCreateBuild ? (
        <Alert message={t('admin.desktopBuild.assets.incomplete')} type="warning" />
      ) : null}
      <DesktopBuildHistory releases={(releases.data as any[]) ?? []} />
      <CreateDesktopReleaseModal
        assets={savedAssets}
        formValues={savedFormValues ?? buildProfileFormFromProfile(selectedProfile)}
        open={releaseOpen}
        profile={selectedProfile}
        onClose={() => setReleaseOpen(false)}
        onCreated={() => void releases.mutate()}
      />
    </div>
  );
});

BuildProfilePage.displayName = 'BuildProfilePage';

export default BuildProfilePage;
