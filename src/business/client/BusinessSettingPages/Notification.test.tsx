import { render, screen } from '@testing-library/react';

import Notification from './Notification';

type MockNotificationConfig = {
  desktopEnabled: boolean;
  emailEnabled: boolean;
  eventDefaults?: unknown;
  inboxEnabled: boolean;
  pushEnabled: boolean;
  system: {
    actionLabel?: null | string;
    actionUrl: null | string;
    content: string;
    enabled: boolean;
    title: string;
    type?: null | string;
  };
};

const { mockIsDesktop, mockNotificationConfig } = vi.hoisted(() => ({
  mockIsDesktop: vi.fn(() => true),
  mockNotificationConfig: vi.fn<() => MockNotificationConfig>(() => ({
    desktopEnabled: true,
    emailEnabled: false,
    eventDefaults: undefined,
    inboxEnabled: true,
    pushEnabled: true,
    system: {
      actionUrl: null as string | null,
      content: '',
      enabled: false,
      title: '',
    },
  })),
}));

vi.mock('@lobechat/const', () => ({
  get isDesktop() {
    return mockIsDesktop();
  },
}));

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: () => ({
    data: mockNotificationConfig(),
  }),
}));

vi.mock('@/routes/(main)/settings/features/SettingHeader', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('@/services/adminCommercial', () => ({
  adminCommercialService: {
    getPublicNotificationConfig: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      ({
        'notification.email.desc': '重要事件发生时接收邮件通知。',
        'notification.email.title': '邮件通知',
        'notification.enabled': '已启用',
        'notification.inbox.desc': '在站内收件箱显示通知。',
        'notification.inbox.title': '站内通知',
        'tab.notification': '通知',
      })[key] ??
      fallback ??
      key,
  }),
}));

vi.mock('./SubscriptionIframeWrapper', () => ({
  SubscriptionIframeWrapper: ({ page }: { page: string }) => (
    <div data-page={page} data-testid="subscription-iframe-wrapper" />
  ),
}));

describe('Notification', () => {
  beforeEach(() => {
    mockIsDesktop.mockReturnValue(true);
    mockNotificationConfig.mockReturnValue({
      desktopEnabled: true,
      emailEnabled: false,
      eventDefaults: undefined,
      inboxEnabled: true,
      pushEnabled: true,
      system: {
        actionUrl: null as string | null,
        content: '',
        enabled: false,
        title: '',
      },
    });
  });

  it('renders the notification embed page on desktop', () => {
    render(<Notification />);

    expect(screen.getByTestId('subscription-iframe-wrapper')).toHaveAttribute(
      'data-page',
      'notification',
    );
  });

  it('renders managed notification settings and announcement action on web', () => {
    mockIsDesktop.mockReturnValue(false);
    mockNotificationConfig.mockReturnValue({
      desktopEnabled: false,
      emailEnabled: true,
      eventDefaults: {
        email: {
          lowCredits: false,
        },
        push: {
          videoGenerationCompleted: false,
        },
      },
      inboxEnabled: true,
      pushEnabled: true,
      system: {
        actionLabel: '查看状态',
        actionUrl: 'https://chat.qingyouai.com/status',
        content: '今晚 23:00 进行服务升级。',
        enabled: true,
        title: '系统维护通知',
        type: 'info',
      },
    });

    render(<Notification />);

    expect(screen.getByRole('heading', { name: '通知' })).toBeInTheDocument();
    expect(screen.getByText('站内通知')).toBeInTheDocument();
    expect(screen.getByText('邮件通知')).toBeInTheDocument();
    expect(screen.getByText('移动推送通知')).toBeInTheDocument();
    expect(screen.getByText('积分余额即将用尽')).toBeInTheDocument();
    expect(screen.getByText('工作区邀请')).toBeInTheDocument();
    expect(screen.getByText('系统维护通知')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '邮件通知：积分余额即将用尽' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: '移动推送通知：视频生成完成' })).not.toBeChecked();
    expect(screen.getByRole('link', { name: '查看状态' })).toHaveAttribute(
      'href',
      'https://chat.qingyouai.com/status',
    );
  });
});
