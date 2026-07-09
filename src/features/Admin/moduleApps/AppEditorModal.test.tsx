import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AppEditorModal from './AppEditorModal';

describe('AppEditorModal', () => {
  it('renders module app metadata and section editors', () => {
    render(
      <AppEditorModal open onCancel={vi.fn()} onSubmit={vi.fn()}>
        ignored
      </AppEditorModal>,
    );

    expect(screen.getByText('New module app')).toBeInTheDocument();
    expect(screen.getByLabelText('Module app name')).toBeInTheDocument();
    expect(screen.getByText('Pages')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Plan entitlements')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });
});
