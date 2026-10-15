'use client';

import type { DesktopBuildAsset, DesktopBuildAssetKind } from '@lobechat/types';
import { Alert, Input, Text, TextArea } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/Form.Item name+rules）与受控字段绑定，无 base-ui 行为不变等价物；迁 FormKit 属另行立项。
import { Form } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { type BuildProfileFormValues, WINDOWS_ASSET_KINDS } from './buildProfileForm';
import DesktopBuildAssetUpload from './DesktopBuildAssetUpload';
import { desktopControlCenterStyles } from './styles';

interface BuildProfileEditorProps {
  assets: Partial<Record<DesktopBuildAssetKind, DesktopBuildAsset>>;
  form: ReturnType<typeof Form.useForm<BuildProfileFormValues>>[0];
  identityLocked?: boolean;
  onAssetUploaded: (kind: DesktopBuildAssetKind, asset: DesktopBuildAsset) => void;
  onValuesChange?: () => void;
  profileId: string;
}

const BuildProfileEditor = memo<BuildProfileEditorProps>(
  ({ assets, form, identityLocked, onAssetUploaded, onValuesChange, profileId }) => {
    const { t } = useTranslation('subscription');

    return (
      <Form<BuildProfileFormValues> form={form} layout="vertical" onValuesChange={onValuesChange}>
        <Text as={'h4'} className={desktopControlCenterStyles.sectionTitle}>
          {t('admin.desktopBuild.profile.title')}
        </Text>
        <Form.Item label={t('admin.desktopBuild.applicationName')} name="applicationName">
          <Input />
        </Form.Item>
        <Form.Item
          extra={t('admin.desktopBuild.identity.help')}
          label={t('admin.desktopBuild.applicationId')}
          name="applicationId"
        >
          <Input disabled={identityLocked} />
        </Form.Item>
        <Form.Item
          extra={t('admin.desktopBuild.identity.help')}
          label={t('admin.desktopBuild.protocolScheme')}
          name="protocolScheme"
        >
          <Input disabled={identityLocked} />
        </Form.Item>
        <Form.Item label={t('admin.desktopBuild.executableName')} name="executableName">
          <Input />
        </Form.Item>
        <Form.Item
          extra={t('admin.desktopBuild.publisher.help')}
          label={t('admin.desktopBuild.publisher')}
          name="publisher"
        >
          <Input />
        </Form.Item>
        <Form.Item label={t('admin.desktopBuild.homepage')} name="homepage">
          <Input />
        </Form.Item>
        <Form.Item label={t('admin.desktopBuild.description')} name="description">
          <TextArea autoSize={{ maxRows: 4, minRows: 2 }} />
        </Form.Item>
        <Form.Item label={t('admin.desktopBuild.shortcutName')} name="shortcutName">
          <Input />
        </Form.Item>
        <Form.Item label={t('admin.desktopBuild.uninstallDisplayName')} name="uninstallDisplayName">
          <Input />
        </Form.Item>
        <Form.Item
          extra={t('admin.desktopBuild.installerArtifactName.help')}
          label={t('admin.desktopBuild.installerArtifactName')}
          name="installerArtifactName"
        >
          <Input />
        </Form.Item>
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
