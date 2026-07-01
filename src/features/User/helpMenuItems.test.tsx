import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildCustomHelpMenuItems } from './helpMenuItems';

describe('buildCustomHelpMenuItems', () => {
  it('converts backend help menu config to reusable menu items', () => {
    const items = buildCustomHelpMenuItems([
      { label: 'Docs', url: 'https://docs.example.com' },
      { label: 'Support' },
      { label: ' ' },
    ]);

    expect(items).toHaveLength(2);
    const docsItem = items[0]!;
    const supportItem = items[1]!;

    expect(docsItem.key).toBe('custom-help-0');
    expect(supportItem.key).toBe('custom-help-1');

    render(
      <>
        {docsItem.label}
        {supportItem.label}
      </>,
    );

    const docs = screen.getByRole('link', { name: 'Docs' });
    expect(docs).toHaveAttribute('href', 'https://docs.example.com');
    expect(docs).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Support')).toBeInTheDocument();
  });
});
