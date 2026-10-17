import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BetterAuthSignUpForm from './BetterAuthSignUpForm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null, toString: () => '' }),
}));

vi.mock('react-i18next', () => ({
  Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/libs/better-auth/auth-client', () => ({
  signUp: { email: vi.fn() },
}));

vi.mock('@/business/client/hooks/useBusinessSignup', () => ({
  useBusinessSignup: () => ({
    businessElement: null,
    getCaptchaTokenOnError: vi.fn(),
    getFetchOptions: async () => ({}),
    preSocialSignupCheck: async () => true,
  }),
}));

vi.mock('../../_layout/AuthServerConfigProvider', () => ({
  useAuthServerConfigStore: (selector: (state: any) => any) =>
    selector({
      serverConfig: { enableBusinessFeatures: false, enableEmailVerification: false },
    }),
}));

describe('BetterAuthSignUpForm', () => {
  // J4: antd's `dependencies={['password']}` must behave the same on FormKit —
  // after confirmPassword has been validated (touched by submit), changing the
  // password re-runs its cross-field validation without another submit.
  it('revalidates confirmPassword when password changes after a submit', async () => {
    render(<BetterAuthSignUpForm />);

    fireEvent.change(screen.getByPlaceholderText('betterAuth.signup.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('betterAuth.signup.confirmPasswordPlaceholder'), {
      target: { value: 'Different123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'betterAuth.signup.submit' }));

    expect(await screen.findByText('betterAuth.errors.passwordMismatch')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('betterAuth.signup.passwordPlaceholder'), {
      target: { value: 'Different123' },
    });

    await waitFor(() =>
      expect(screen.queryByText('betterAuth.errors.passwordMismatch')).not.toBeInTheDocument(),
    );
  });
});
