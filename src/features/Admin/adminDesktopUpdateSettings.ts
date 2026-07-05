export const DESKTOP_DEFAULT_BUSINESS_SERVER_URL = 'https://chat.qingyouai.com';

export const DESKTOP_UPDATE_SETTING_KEYS = {
  desktopDownloadLabel: 'desktop.download.label',
  desktopDownloadUrl: 'desktop.download.url',
  desktopLoginCloudButtonLabel: 'desktop.login.cloudButtonLabel',
  desktopLoginDescription: 'desktop.login.description',
  desktopLoginFooterText: 'desktop.login.footerText',
  desktopLoginLogoUrl: 'desktop.login.logoUrl',
  desktopLoginTitle: 'desktop.login.title',
  desktopLoginWindowTitle: 'desktop.login.windowTitle',
  desktopOssAccessKeyId: 'desktop.oss.accessKeyId',
  desktopOssAccessKeySecret: 'desktop.oss.accessKeySecret',
  desktopOssBucket: 'desktop.oss.bucket',
  desktopOssEndpoint: 'desktop.oss.endpoint',
  desktopOssPath: 'desktop.oss.path',
  desktopUpdateAutoCheck: 'desktop.update.autoCheck',
  desktopUpdateChannel: 'desktop.update.channel',
  desktopUpdateCheckInterval: 'desktop.update.checkInterval',
  desktopUpdateCurrentVersion: 'desktop.update.currentVersion',
  desktopUpdateReleaseNotes: 'desktop.update.releaseNotes',
  desktopUpdateServerUrl: 'desktop.update.serverUrl',
} as const;

export const DESKTOP_SETTINGS_SECTIONS = [
  {
    key: 'businessConnection',
    readonly: true,
    title: '桌面业务连接',
  },
  {
    key: 'loginPage',
    readonly: false,
    title: '客户端登录页',
  },
  {
    key: 'updateServer',
    readonly: false,
    title: '更新服务',
  },
  {
    key: 'autoCheck',
    readonly: false,
    title: '自动检查',
  },
  {
    key: 'releaseInfo',
    readonly: false,
    title: '当前发布版本',
  },
  {
    key: 'downloadEntry',
    readonly: false,
    title: '客户端下载入口',
  },
  {
    key: 'ossStorage',
    readonly: false,
    title: '阿里云对象存储（OSS）',
  },
] as const;
