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
    Trans: () => <span>terms and privacy</span>,
    useTranslation: () => ({
      t: (key: string, vars?: { appName?: string; defaultValue?: string }) => {
        if (key === 'signin.subtitle') return `Sign in or sign up for ${vars?.appName}`;
        if (key === 'betterAuth.signin.passwordStep.subtitle') return 'Enter password to continue';
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
    authTitle: 'Admin auth title',
    copyrightText: '2026 XuanGuo AI',
    defaultSkillName: 'XuanGuo Assistant',
    faviconUrl: null,
    loadingText: 'Loading text should not appear here',
    logoUrl: null,
    name: 'XuanGuo AI',
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

describe('SignIn runtime brand copy', () => {
  it('renders the upstream title while keeping the configured brand name on the email step', () => {
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

    expect(
      screen.getByRole('heading', { name: 'Agent teammates that grow with you' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sign in or sign up for XuanGuo AI')).toBeInTheDocument();
    expect(screen.queryByText('Sign in or sign up for LobeHub')).not.toBeInTheDocument();
  });

  it('renders the upstream title on the password step', () => {
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

    expect(screen.getByRole('heading', { name: 'Agent teammates that grow with you' })).toBeInTheDocument();
  });
});
