import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import AppCard from './AppCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ModuleAppCard', () => {
  it('links to the app detail and shows installation state', () => {
    render(
      <MemoryRouter>
        <AppCard installed category="business" id="app-1" name="Recruiting Desk" />
      </MemoryRouter>,
    );

    expect(screen.getByText('moduleApps.market.installed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'moduleApps.market.viewDetails' })).toHaveAttribute(
      'href',
      '/apps/app-1',
    );
  });
});
