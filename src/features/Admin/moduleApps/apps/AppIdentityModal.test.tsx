import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AppIdentityModal from './AppIdentityModal';

vi.mock('@lobehub/ui/base-ui', () => ({
  Modal: ({ children, okButtonProps, onOk, open, title }: any) =>
    open ? (
      <div>
        <h2>{title}</h2>
        {children}
        <button disabled={okButtonProps?.disabled} type="button" onClick={onOk}>
          submit
        </button>
      </div>
    ) : null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('AppIdentityModal', () => {
  it('starts new applications from the non-sensitive identity draft', () => {
    const onDraftChange = vi.fn();
    render(
      <AppIdentityModal
        draft={{ category: 'office', displayName: 'Draft app', slug: 'draft-app' }}
        open
        onCancel={vi.fn()}
        onDraftChange={onDraftChange}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('Draft app')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Draft app'), { target: { value: 'Changed app' } });
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ displayName: 'Changed app', slug: 'draft-app' }),
    );
  });

  it('requires category and description before submitting the identity', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AppIdentityModal
        draft={{ displayName: 'Draft app', slug: 'draft-app' }}
        open
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const submit = screen.getByRole('button', { name: 'submit' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('moduleApps.admin.apps.identity.category'), {
      target: { value: 'office' },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('moduleApps.admin.apps.identity.description'), {
      target: { value: 'A useful application.' },
    });
    expect(submit).toBeEnabled();
  });

  it('surfaces server errors without discarding entered values', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Server rejected identity'));
    render(
      <AppIdentityModal
        draft={{
          category: 'office',
          description: 'A useful application.',
          displayName: 'Draft app',
          slug: 'draft-app',
        }}
        open
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server rejected identity');
    expect(screen.getByDisplayValue('Draft app')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A useful application.')).toBeInTheDocument();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});
