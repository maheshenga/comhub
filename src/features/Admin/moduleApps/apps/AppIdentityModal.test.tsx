import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AppIdentityModal from './AppIdentityModal';

vi.mock('@lobehub/ui/base-ui', () => ({
  Modal: ({ children, onOk, open, title }: any) =>
    open ? (
      <div>
        <h2>{title}</h2>
        {children}
        <button type="button" onClick={onOk}>
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
});
