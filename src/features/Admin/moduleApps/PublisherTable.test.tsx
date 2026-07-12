import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PublisherTable from './PublisherTable';

describe('PublisherTable', () => {
  it('renders publisher identity and masked Alipay recipient', () => {
    render(
      <PublisherTable
        items={[
          {
            appCount: 3,
            displayName: 'Verified Studio',
            id: 'publisher-1',
            recipientMask: 'ali***@example.com',
            status: 'verified',
            userId: 'user-1',
          },
        ]}
      />,
    );

    expect(screen.getByText('Verified Studio')).toBeInTheDocument();
    expect(screen.getByText('ali***@example.com')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders a stable empty state', () => {
    render(<PublisherTable items={[]} />);
    expect(screen.getByText('No publishers')).toBeInTheDocument();
  });
});
