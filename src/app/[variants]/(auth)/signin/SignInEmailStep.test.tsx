import { useForm } from '@lobehub/ui/base-ui/form';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SignInEmailStep } from './SignInEmailStep';

const mocks = vi.hoisted(() => ({
  brand: {
    authTitle: 'Admin auth title',
    name: 'ComHub Runtime',
  },
}));

vi.mock('@lobechat/business-const', () => ({
  BRANDING_NAME: 'LobeHub',
}));

vi.mock('@/features/Brand', () => ({
  useBrand: () => mocks.brand,
}));

vi.mock('react-i18next', () => ({
  Trans: () => <span>agreement</span>,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      if (key === 'signin.subtitle') return `Sign in to ${options?.appName}`;
      if (key === 'betterAuth.signin.emailPlaceholder') return 'Email';
      return key;
    },
  }),
}));

vi.mock('@/components/AuthIcons', () => ({
  default: () => null,
}));

const TestSignInEmailStep = () => {
  const form = useForm<{ email: string }>();

  return (
    <SignInEmailStep
      serverConfigInit
      agreementChecked={false}
      continueWithAgreement={(continueAction) => continueAction()}
      disableEmailPassword={false}
      form={form}
      isSocialOnly={false}
      loading={false}
      oAuthSSOProviders={[]}
      setAgreementChecked={vi.fn()}
      socialLoading={null}
      onGoToSignup={vi.fn()}
      onResetEmail={vi.fn()}
      onSetPassword={vi.fn()}
      onSocialSignIn={vi.fn()}
    />
  );
};

describe('SignInEmailStep', () => {
  it('uses the admin-configured name without replacing the upstream sign-in hierarchy', () => {
    render(<TestSignInEmailStep />);

    expect(screen.getByText('Sign in to ComHub Runtime')).toBeInTheDocument();
    expect(screen.queryByText('Admin auth title')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign in to LobeHub')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'betterAuth.signin.nextStep' })).toBeInTheDocument();
  });
});
