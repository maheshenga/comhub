/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BusinessTableError } from './shared';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, ...props }: { children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

describe('BusinessTableError', () => {
  it('announces itself as an alert and offers a retry', () => {
    const onRetry = vi.fn();

    render(<BusinessTableError onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'mobile.error.retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('omits the retry button when no handler is supplied', () => {
    render(<BusinessTableError />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
