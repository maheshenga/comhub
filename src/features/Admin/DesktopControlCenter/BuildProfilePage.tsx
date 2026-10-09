'use client';

import type { DesktopBuildAsset, DesktopBuildAssetKind } from '@lobechat/types';
import { Button, confirmModal } from '@lobehub/ui/base-ui';
import { Alert, Form, message, Skeleton } from 'antd';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import AdminDangerousActionButton from '../AdminDangerousActionButton';
import { buildAdminDangerousActionEnvelope } from '../adminDangerousActions';
import BuildProfileEditor from './BuildProfileEditor';
import {
  buildProfileFormFromProfile,
  type BuildProfileFormValues,
  buildProfilePayloadFromForm,
  createDefaultBuildProfileForm,
  hasCompleteWindowsAssets,
} from './buildProfileForm';
import CreateDesktopReleaseModal from './CreateDesktopReleaseModal';
import { BuildProfileHeader } from './buildProfileHeader';
import DesktopBuildHistory, { type DesktopReleaseHistoryItem } from './DesktopBuildHistory';
import { desktopControlCenterStyles } from './styles';

type DraftAssetManifest = Partial<Record<DesktopBuildAssetKind, DesktopBuildAsset>>;

export interface BuildProfileView {
  currentDraft?: {
    assetManifest?: DraftAssetManifest;
    payload?: Partial<BuildProfileFormValues>;
  };
  currentRevision?: number;
  id: string;
  identityLocked?: boolean;
  name: string;
  status?: 'active' | 'archived';
}

interface BuildProfilePageProps {
  currentRelease?: { channel: 'canary' | 'stable'; version: string };
  onDirtyChange?: (dirty: boolean) => void;
  onReleaseActivated?: () => Promise<unknown> | unknown;
}

const getProfileItems = (data: unknown): BuildProfileView[] =>
  (((data as { items?: BuildProfileView[] } | undefined)?.items ?? []) as BuildProfileView[]);

const withDraftApplied = (
  current: BuildProfileView,
  assets: DraftAssetManifest,
  payload: Partial<BuildProfileFormValues>,
): BuildProfileView => ({
  ...current,
  currentDraft: { assetManifest: assets, payload },
  currentRevision: (current.currentRevision ?? 0) + 1,
  name: payload.applicationName ?? current.name,
});
const LoadFailedAlert = ({ onRetry, t }: { onRetry: () => void; t: any }) => (
  <Alert
    title={t('admin.desktopBuild.loadFailed')}
    type="error"
    action={<Button onClick={onRetry}>{t('admin.desktopControl.retry')}</Button>}
  />
);
const EmptyProfilesAlert = ({ onCreate, t }: { onCreate: () => void; t: any }) => (
  <Alert
    description={t('admin.desktopBuild.emptyDescription')}
    title={t('admin.desktopBuild.empty')}
    type="info"
    action={<Button onClick={onCreate}>{t('admin.desktopBuild.profile.create')}</Button>}
  />
);
const BuildProfilePage = memo<BuildProfilePageProps>(
  ({ currentRelease, onDirtyChange, onReleaseActivated }) => {
    const { t } = useTranslation('subscription');
    const [form] = Form.useForm<BuildProfileFormValues>();
    const profiles = useClientDataSWR(['admin-desktop-build-profiles'], () =>
      adminCommercialService.listBuildProfiles({ limit: 50 }),
    );
    const profileItems = getProfileItems(profiles.data);
    const [selectedProfileId, setSelectedProfileId] = useState<string>();
    const [localProfile, setLocalProfile] = useState<BuildProfileView>();
    const selectedProfile = useMemo(
      () =>
        profileItems.find((profile) => profile.id === selectedProfileId) ??
        (localProfile?.id === selectedProfileId ? localProfile : undefined) ??
        profileItems[0] ??
        localProfile,
      [localProfile, profileItems, selectedProfileId],
    );
    const isLocalProfile = Boolean(
      selectedProfile &&
      localProfile?.id === selectedProfile.id &&
      !profileItems.some((profile) => profile.id === selectedProfile.id),
    );
    const [assets, setAssets] = useState<DraftAssetManifest>({});
    const [savedAssets, setSavedAssets] = useState<DraftAssetManifest>({});
    const [savedFormValues, setSavedFormValues] = useState<BuildProfileFormValues>();
    const [baseRevision, setBaseRevision] = useState(0);
    const [saving, setSaving] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const dirtyRef = useRef(false);
    const loadedProfileIdRef = useRef<string | undefined>(undefined);
    const [releaseOpen, setReleaseOpen] = useState(false);
    const releases = useClientDataSWR(['admin-desktop-releases', selectedProfile?.id], () =>
      selectedProfile?.id
        ? adminCommercialService.listDesktopReleases({ limit: 25, profileId: selectedProfile.id })
        : Promise.resolve([]),
    );

    const confirmDiscard = (onConfirm: () => void) =>
      confirmModal({
        cancelText: t('admin.desktopControl.unsaved.cancel'),
        content: t('admin.desktopControl.unsaved.description'),
        okText: t('admin.desktopControl.unsaved.discard'),
        onOk: onConfirm,
        title: t('admin.desktopControl.unsaved.title'),
      });

    const createProfile = () => {
      const id = globalThis.crypto.randomUUID();
      setLocalProfile({
        currentRevision: 0,
        id,
        identityLocked: false,
        name: createDefaultBuildProfileForm().applicationName,
        status: 'active',
      });
      setSelectedProfileId(id);
    };
    const handleCreateProfile = () => {
      if (dirty) return confirmDiscard(createProfile);
      createProfile();
    };
    const handleSelectProfile = (profileId: string) => {
      if (profileId === selectedProfile?.id) return;
      if (dirty) return confirmDiscard(() => setSelectedProfileId(profileId));
      setSelectedProfileId(profileId);
    };

    useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
    const markDirty = () => {
      dirtyRef.current = true;
      setDirty(true);
    };
    const markClean = () => {
      dirtyRef.current = false;
      setDirty(false);
    };

    useEffect(() => {
      if (!selectedProfile) return;
      if (dirtyRef.current && loadedProfileIdRef.current === selectedProfile.id) return;
      setSelectedProfileId((current) => current ?? selectedProfile.id);
      const profileFormValues = buildProfileFormFromProfile(selectedProfile);
      form.setFieldsValue(profileFormValues);
      const assetManifest = selectedProfile.currentDraft?.assetManifest ?? {};
      setAssets(assetManifest);
      setSavedAssets(assetManifest);
      setSavedFormValues(profileFormValues);
      setBaseRevision(selectedProfile.currentRevision ?? 0);
      loadedProfileIdRef.current = selectedProfile.id;
      markClean();
    }, [form, selectedProfile]);

    if (profiles.error) {
      return <LoadFailedAlert onRetry={() => void profiles.mutate()} t={t as any} />;
    }
    if (profiles.isLoading && !profiles.data) return <Skeleton active paragraph={{ rows: 8 }} />;
    if (!selectedProfile) return <EmptyProfilesAlert onCreate={handleCreateProfile} t={t as any} />;

    const canCreateBuild = hasCompleteWindowsAssets(savedAssets);
    const canSaveDraft = hasCompleteWindowsAssets(assets);

    const handleSaveDraft = async () => {
      const payload = buildProfilePayloadFromForm(await form.validateFields());
      if (!hasCompleteWindowsAssets(assets)) return;
      setSaving(true);
      try {
        await adminCommercialService.saveBuildProfileDraft({
          assets,
          command: buildAdminDangerousActionEnvelope('desktop.buildProfile.saveDraft', {
            confirmed: true,
          }),
          ...(isLocalProfile ? { createIfMissing: true } : {}),
          expectedRevision: baseRevision,
          name: payload.applicationName,
          payload,
          profileId: selectedProfile.id,
        });
        setSavedAssets(assets);
        setSavedFormValues(payload);
        markClean();
        if (isLocalProfile) {
          setLocalProfile((current) =>
            current ? withDraftApplied(current, assets, payload) : current,
          );
        }
        await profiles.mutate();
        message.success(t('admin.desktopBuild.saveSuccess'));
      } catch (error) {
        const conflict = error instanceof Error && error.message.includes(
          'DESKTOP_BUILD_PROFILE_REVISION_CONFLICT',
        );
        message.error(
          conflict ? t('admin.desktopBuild.revisionConflict') : t('admin.desktopBuild.saveFailed'),
        );
      } finally {
        setSaving(false);
      }
    };

    const performArchiveProfile = async (
      envelope: ReturnType<typeof buildAdminDangerousActionEnvelope<'desktop.buildProfile.archive'>>,
    ) => {
      if (!selectedProfile) return;
      setArchiving(true);
      try {
        await adminCommercialService.archiveBuildProfile(selectedProfile.id, envelope);
        markClean();
        setSelectedProfileId(undefined);
        await profiles.mutate();
        message.success(t('admin.desktopBuild.profile.archiveSuccess'));
      } catch {
        message.error(t('admin.desktopBuild.profile.archiveFailed'));
      } finally {
        setArchiving(false);
      }
    };

    return (
      <div className={desktopControlCenterStyles.buildProfileLayout}>
        <BuildProfileHeader
          archiving={archiving}
          isLocalProfile={isLocalProfile}
          localProfile={localProfile}
          profileItems={profileItems}
          selectedProfileId={selectedProfile.id}
          t={t as any}
          onArchive={(envelope) => void performArchiveProfile(envelope)}
          onSelect={handleSelectProfile}
        />
        <Alert
          showIcon
          description={t('admin.desktopBuild.publisher.description')}
          title={t('admin.desktopBuild.publisher.notice')}
          type="info"
        />
        <BuildProfileEditor
          assets={assets}
          form={form}
          identityLocked={selectedProfile.identityLocked}
          profileId={selectedProfile.id}
          onValuesChange={markDirty}
          onAssetUploaded={(kind, asset) => {
            setAssets((current) => ({ ...current, [kind]: asset }));
            markDirty();
          }}
        />
        <div className={desktopControlCenterStyles.formActions}>
          <AdminDangerousActionButton
            actionId="desktop.buildProfile.saveDraft"
            disabled={!canSaveDraft}
            loading={saving}
            onConfirm={() => handleSaveDraft()}
          >
            {t('admin.desktopBuild.saveDraft')}
          </AdminDangerousActionButton>
          <Button disabled={!canCreateBuild} type="primary" onClick={() => setReleaseOpen(true)}>
            {t('admin.desktopBuild.createBuild')}
          </Button>
        </div>
        {!canCreateBuild ? (
          <Alert title={t('admin.desktopBuild.assets.incomplete')} type="warning" />
        ) : null}
        <DesktopBuildHistory
          currentRelease={currentRelease}
          releases={(releases.data as DesktopReleaseHistoryItem[] | undefined) ?? []}
          onActivated={onReleaseActivated}
          onReconciled={() => releases.mutate()}
        />
        <CreateDesktopReleaseModal
          assets={savedAssets}
          formValues={savedFormValues ?? buildProfileFormFromProfile(selectedProfile)}
          open={releaseOpen}
          profile={selectedProfile}
          onClose={() => setReleaseOpen(false)}
          onReleaseChanged={() => void releases.mutate()}
        />
      </div>
    );
  },
);

BuildProfilePage.displayName = 'BuildProfilePage';

export default BuildProfilePage;
