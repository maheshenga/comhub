'use client';

import type { DesktopBuildAsset, DesktopBuildAssetKind } from '@lobechat/types';
import { Alert, Input, Text, TextArea } from '@lobehub/ui';
import { Form, type FormInstance } from '@lobehub/ui/form';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { type BuildProfileFormValues, WINDOWS_ASSET_KINDS } from './buildProfileForm';
import DesktopBuildAssetUpload from './DesktopBuildAssetUpload';
import { desktopControlCenterStyles } from './styles';

interface BuildProfileEditorProps {
  assets: Partial<Record<DesktopBuildAssetKind, DesktopBuildAsset>>;
  form: FormInstance<BuildProfileFormValues>;
  identityLocked?: boolean;
  onAssetUploaded: (kind: DesktopBuildAssetKind, asset: DesktopBuildAsset) => void;
  profileId: string;
}

const BuildProfileEditor = memo<BuildProfileEditorProps>(
  ({ assets, form, identityLocked, onAssetUploaded, profileId }) => {
    const { t } = useTranslation('subscription');

    return (
      <Form<BuildProfileFormValues> form={form} layout="vertical">
        <Text as={'h4'} className={desktopControlCenterStyles.sectionTitle}>
          {t('admin.desktopBuild.profile.title')}
        </Text>
        <Form.Field label={t('admin.desktopBuild.applicationName')} name="applicationName">
          <Input />
        </Form.Field>
        <Form.Field
          extra={t('admin.desktopBuild.identity.help')}
          label={t('admin.desktopBuild.applicationId')}
          name="applicationId"
        >
          <Input disabled={identityLocked} />
        </Form.Field>
        <Form.Field
          extra={t('admin.desktopBuild.identity.help')}
          label={t('admin.desktopBuild.protocolScheme')}
          name="protocolScheme"
        >
          <Input disabled={identityLocked} />
        </Form.Field>
        <Form.Field label={t('admin.desktopBuild.executableName')} name="executableName">
          <Input />
        </Form.Field>
        <Form.Field
          extra={t('admin.desktopBuild.publisher.help')}
          label={t('admin.desktopBuild.publisher')}
          name="publisher"
        >
          <Input />
        </Form.Field>
        <Form.Field label={t('admin.desktopBuild.homepage')} name="homepage">
          <Input />
        </Form.Field>
        <Form.Field label={t('admin.desktopBuild.description')} name="description">
          <TextArea autoSize={{ maxRows: 4, minRows: 2 }} />
        </Form.Field>
        <Form.Field label={t('admin.desktopBuild.shortcutName')} name="shortcutName">
          <Input />
        </Form.Field>
        <Form.Field
          label={t('admin.desktopBuild.uninstallDisplayName')}
          name="uninstallDisplayName"
        >
          <Input />
        </Form.Field>
        <Form.Field
          extra={t('admin.desktopBuild.installerArtifactName.help')}
          label={t('admin.desktopBuild.installerArtifactName')}
          name="installerArtifactName"
        >
          <Input />
        </Form.Field>
        {identityLocked ? (
          <Alert message={t('admin.desktopBuild.identity.locked')} type="info" />
        ) : null}
        <Text as={'h4'} className={desktopControlCenterStyles.sectionTitle}>
          {t('admin.desktopBuild.assets.title')}
        </Text>
        <div className={desktopControlCenterStyles.assetGrid}>
          {WINDOWS_ASSET_KINDS.map((kind) => (
            <DesktopBuildAssetUpload
              asset={assets[kind]}
              key={kind}
              kind={kind}
              profileId={profileId}
              onUploaded={(asset) => onAssetUploaded(kind, asset)}
            />
          ))}
        </div>
      </Form>
    );
  },
);

BuildProfileEditor.displayName = 'BuildProfileEditor';

export default BuildProfileEditor;
