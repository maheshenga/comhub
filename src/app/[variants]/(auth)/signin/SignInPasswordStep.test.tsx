import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SignInPasswordStep } from './SignInPasswordStep';

const mocks = vi.hoisted(() => ({
  brand: {
    authTitle: 'Admin auth title',
  },
  form: {
    submit: vi.fn(),
  },
}));

vi.mock('@/features/Brand', () => ({
  useBrand: () => mocks.brand,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  const Form = ({ children }: { children: React.ReactNode }) => <form>{children}</form>;
  Form.Item = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

  return {
    ...actual,
    Form,
  };
});

describe('SignInPasswordStep', () => {
  it('uses the admin-configured auth title in the upstream password step', () => {
    render(
      <SignInPasswordStep
        email="user@example.com"
        form={mocks.form as any}
        loading={false}
        onBackToEmail={vi.fn()}
        onForgotPassword={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('Admin auth title')).toBeInTheDocument();
    expect(screen.queryByText('Agent teammates that grow with you')).not.toBeInTheDocument();
  });
});
