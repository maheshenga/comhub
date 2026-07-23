import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@lobehub/ui/base-ui', () => ({
  Modal: ({ children, okButtonProps, okText, onOk, open }: any) =>
    open ? (
      <div>
        {children}
        <button disabled={okButtonProps?.disabled} type="button" onClick={onOk}>
          {okText}
        </button>
      </div>
    ) : null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import PublisherFormModal from './PublisherFormModal';

describe('PublisherFormModal', () => {
  it('submits trimmed publisher identity with an optional masked recipient', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PublisherFormModal open onCancel={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('moduleApps.admin.publishers.displayName'), {
      target: { value: ' Studio ' },
    });
    fireEvent.change(screen.getByLabelText('moduleApps.admin.publishers.ownerUserId'), {
      target: { value: ' owner-1 ' },
    });
    fireEvent.change(screen.getByLabelText('moduleApps.admin.publishers.recipientMask'), {
      target: { value: ' ali***@example.com ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.admin.publishers.create' }));

    expect(onSubmit).toHaveBeenCalledWith({
      displayName: 'Studio',
      recipientMask: 'ali***@example.com',
      userId: 'owner-1',
    });
  });
});
