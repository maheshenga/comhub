import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ModuleAppMarket from './index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./MyAppsOverview', () => ({
  default: () => <div>my-apps-overview</div>,
}));

describe('ModuleAppMarket', () => {
  it.each([
    ['all', 'moduleApps.market.title'],
    ['my', 'moduleApps.my.title'],
    ['team', 'moduleApps.team.title'],
  ] as const)('uses translated heading for %s mode', (mode, key) => {
    render(<ModuleAppMarket mode={mode} />);

    expect(screen.getByRole('heading', { name: key })).toBeInTheDocument();
  });
});