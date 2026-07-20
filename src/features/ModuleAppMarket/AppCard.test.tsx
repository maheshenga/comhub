import { ConfigProvider } from '@lobehub/ui';
import { render, screen } from '@testing-library/react';
import * as m from 'motion/react-m';
import { type ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import AppCard from './AppCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) =>
      key === 'moduleApps.market.viewDetailsFor'
        ? `View details for ${values?.name ?? ''}`
        : key,
  }),
}));

const renderCard = (ui: ReactElement) =>
  render(
    <ConfigProvider motion={m}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ConfigProvider>,
  );

describe('ModuleAppCard', () => {
  it('links to the app detail and shows installation state', () => {
    renderCard(<AppCard installed category="business" id="app-1" name="Recruiting Desk" />);

    const card = screen.getByRole('article', { name: 'Recruiting Desk' });
    expect(card).toHaveStyle({ borderRadius: '8px', minWidth: '0' });
    expect(screen.getByText('moduleApps.market.installed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View details for Recruiting Desk' })).toHaveAttribute(
      'href',
      '/apps/app-1',
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('wraps metadata and preserves an encoded workspace detail URL', () => {
    renderCard(
      <AppCard
        category="creative tools"
        description="A long description that remains inside the card."
        id="app-2"
        name="Studio"
        version="2.4.0"
        workspaceId="workspace/team 1"
      />,
    );

    const card = screen.getByRole('article', { name: 'Studio' });
    expect(card).toHaveTextContent('creative tools');
    expect(card).toHaveTextContent('2.4.0');
    expect(card).toHaveTextContent('A long description that remains inside the card.');
    expect(screen.getByRole('link', { name: 'View details for Studio' })).toHaveAttribute(
      'href',
      '/apps/app-2?workspaceId=workspace%2Fteam%201',
    );
  });
});
