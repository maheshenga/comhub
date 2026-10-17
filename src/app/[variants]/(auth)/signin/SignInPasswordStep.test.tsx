import { type FormInstance, useForm } from '@lobehub/ui/base-ui/form';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SignInPasswordStep } from './SignInPasswordStep';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === 'betterAuth.signin.passwordStep.title' ? 'Enter your password' : key,
  }),
}));

const TestSignInPasswordStep = () => {
  const form = useForm<{ password: string }>();

  return (
    <SignInPasswordStep
      email="user@example.com"
      forgotLoading={false}
      form={form}
      loading={false}
      onBackToEmail={vi.fn()}
      onForgotPassword={vi.fn()}
    />
  );
};

describe('SignInPasswordStep', () => {
  it('uses the upstream password title and the account email as subtitle', () => {
    render(<TestSignInPasswordStep />);

    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  // J2: useSignIn reports bad credentials via form.setErrors; the FormKit
  // Form.Field error node must render that message inline (not a toast).
  it('renders a form-level server error inline under the password field', async () => {
    let formRef: FormInstance<{ password: string }> | undefined;

    const Harness = () => {
      const form = useForm<{ password: string }>();
      formRef = form;

      return (
        <SignInPasswordStep
          email="user@example.com"
          forgotLoading={false}
          form={form}
          loading={false}
          onBackToEmail={vi.fn()}
          onForgotPassword={vi.fn()}
        />
      );
    };

    render(<Harness />);

    act(() => {
      formRef!.setErrors({ password: 'Invalid credentials' });
    });

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });
});
