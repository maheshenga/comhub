import type {
  DesktopBuildAsset,
  DesktopBuildAssetKind,
  DesktopBuildAssetManifest,
  DesktopBuildProfilePayload,
} from '@lobechat/types';

export type BuildProfileFormValues = DesktopBuildProfilePayload;

export const WINDOWS_ASSET_KINDS = [
  'appPreview',
  'nsisHeader',
  'nsisSidebar',
  'windowsIcon',
] as const satisfies DesktopBuildAssetKind[];

export const createDefaultBuildProfileForm = (): BuildProfileFormValues => ({
  applicationId: 'com.qingyou.comhub',
  applicationName: 'ComHub',
  description: 'ComHub desktop',
  executableName: 'ComHub',
  homepage: 'https://chat.qingyouai.com',
  installerArtifactName: '${productName}-${version}-${arch}.${ext}',
  protocolScheme: 'comhub',
  publisher: 'Qingyou',
  shortcutName: 'ComHub',
  uninstallDisplayName: 'ComHub',
});

export const buildProfilePayloadFromForm = (
  values: BuildProfileFormValues,
): DesktopBuildProfilePayload => ({
  applicationId: values.applicationId?.trim() || '',
  applicationName: values.applicationName?.trim() || '',
  description: values.description?.trim() || '',
  executableName: values.executableName?.trim() || '',
  homepage: values.homepage?.trim() || '',
  installerArtifactName: values.installerArtifactName?.trim() || '',
  protocolScheme: values.protocolScheme?.trim() || '',
  publisher: values.publisher?.trim() || '',
  shortcutName: values.shortcutName?.trim() || '',
  uninstallDisplayName: values.uninstallDisplayName?.trim() || '',
});

export const buildProfileFormFromProfile = (profile?: {
  currentDraft?: { payload?: Partial<DesktopBuildProfilePayload> | null } | null;
}) => ({
  ...createDefaultBuildProfileForm(),
  ...profile?.currentDraft?.payload,
});

export const hasCompleteWindowsAssets = (
  assets?: Partial<Record<DesktopBuildAssetKind, DesktopBuildAsset>> | null,
): assets is DesktopBuildAssetManifest =>
  Boolean(assets && WINDOWS_ASSET_KINDS.every((kind) => assets[kind]?.key));

export const renderInstallerArtifactName = (
  template: string,
  values: { arch: string; ext: string; productName: string; version: string },
) =>
  template
    .replaceAll('${productName}', values.productName)
    .replaceAll('${version}', values.version)
    .replaceAll('${arch}', values.arch)
    .replaceAll('${ext}', values.ext);
