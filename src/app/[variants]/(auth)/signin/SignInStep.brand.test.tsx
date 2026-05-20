import { render, screen } from '@testing-library/react';
import { type ReactNode, type Ref } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SignInEmailStep } from './SignInEmailStep';
import { SignInPasswordStep } from './SignInPasswordStep';

vi.mock('@lobechat/business-const', () => ({
  BRANDING_NAME: 'LobeHub',
}));

vi.mock('@lobehub/ui', () => {
  return {
    Alert: ({ description }: { description?: ReactNode }) => <div>{description}</div>,
    Button: ({
      children,
      title,
      onClick,
    }: {
      children?: ReactNode;
      onClick?: () => void;
      title?: string;
    }) => (
      <button title={title} type="button" onClick={onClick}>
        {children}
      </button>
    ),
    Flexbox: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Icon: () => null,
    Input: ({ placeholder, ref }: { placeholder?: string; ref?: Ref<HTMLInputElement> }) => (
      <input placeholder={placeholder} ref={ref} />
    ),
    InputPassword: ({
      placeholder,
      ref,
    }: {
      placeholder?: string;
      ref?: Ref<HTMLInputElement>;
    }) => <input placeholder={placeholder} ref={ref} type="password" />,
    Skeleton: {
      Button: () => <div data-testid="skeleton-button" />,
    },
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  };
});

vi.mock('antd', () => {
  const Form = ({ children }: { children?: ReactNode }) => <form>{children}</form>;
  Form.Item = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    Badge: {
      Ribbon: ({ children, text }: { children?: ReactNode; text?: ReactNode }) => (
        <div>
          {text}
          {children}
        </div>
      ),
    },
    Divider: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Form,
  };
});

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({ setPasswordLink: 'setPasswordLink' }),
  cssVar: { colorPrimary: '#12b981' },
}));

vi.mock('lucide-react', () => ({
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Lock: 'Lock',
  Mail: 'Mail',
}));

vi.mock('react-i18next', () => {
  return {
    Trans: () => <span>服务条款与隐私政策</span>,
    useTranslation: () => ({
      t: (key: string, vars?: { appName?: string; defaultValue?: string }) => {
        if (key === 'signin.subtitle') return `登录或注册 ${vars?.appName} 账号`;
        if (key === 'betterAuth.signin.passwordStep.subtitle') return '输入密码继续';
        return vars?.defaultValue ?? key;
      },
    }),
  };
});

vi.mock('@/components/AuthIcons', () => ({
  default: () => 'Icon',
}));

vi.mock('@/const/url', () => ({
  PRIVACY_URL: '/privacy',
  TERMS_URL: '/terms',
}));

vi.mock('@/features/Brand', () => ({
  useBrand: () => ({
    authTitle: '后台设置登录标题',
    copyrightText: '© 2026 玄果AI',
    defaultSkillName: '玄果助手',
    faviconUrl: null,
    loadingText: '后台加载文案不应出现在这里',
    logoUrl: null,
    name: '玄果AI',
    primaryColor: null,
    slogan: null,
  }),
}));

vi.mock('../../../../features/AuthCard', () => ({
  default: ({
    children,
    footer,
    subtitle,
    title,
  }: {
    children?: ReactNode;
    footer?: ReactNode;
    subtitle?: ReactNode;
    title?: ReactNode;
  }) => (
    <section>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <main>{children}</main>
      <footer>{footer}</footer>
    </section>
  ),
}));

const form = {
  submit: vi.fn(),
};

describe('SignIn brand copy', () => {
  it('renders the admin configured auth title and brand name on the email step', () => {
    render(
      <SignInEmailStep
        serverConfigInit
        form={form as any}
        isSocialOnly={false}
        loading={false}
        oAuthSSOProviders={[]}
        socialLoading={null}
        onCheckUser={vi.fn()}
        onSetPassword={vi.fn()}
        onSocialSignIn={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '后台设置登录标题' })).toBeInTheDocument();
    expect(screen.getByText('登录或注册 玄果AI 账号')).toBeInTheDocument();
    expect(screen.queryByText('Agent teammates that grow with you')).not.toBeInTheDocument();
    expect(screen.queryByText('登录或注册 LobeHub 账号')).not.toBeInTheDocument();
  });

  it('renders the admin configured auth title on the password step', () => {
    render(
      <SignInPasswordStep
        email="user@example.com"
        form={form as any}
        loading={false}
        onBackToEmail={vi.fn()}
        onForgotPassword={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '后台设置登录标题' })).toBeInTheDocument();
    expect(screen.queryByText('Agent teammates that grow with you')).not.toBeInTheDocument();
  });
});
