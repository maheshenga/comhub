import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminInlineSkeleton } from './AdminPageState';

describe('AdminInlineSkeleton', () => {
  it('renders an inline busy placeholder with the requested row count', () => {
    render(<AdminInlineSkeleton rows={4} />);

    const skeleton = screen.getByTestId('admin-inline-skeleton');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(skeleton.children).toHaveLength(4);
  });

  it('defaults to three rows', () => {
    render(<AdminInlineSkeleton />);

    expect(screen.getByTestId('admin-inline-skeleton').children).toHaveLength(3);
  });
});
