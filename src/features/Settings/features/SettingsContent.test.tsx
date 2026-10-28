import { render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsTabs } from '@/store/global/initialState';

import SettingsContent from './SettingsContent';

const { businessPageSpy } = vi.hoisted(() => ({ businessPageSpy: vi.fn() }));

vi.mock('@/features/NavHeader', () => ({ default: () => null }));
vi.mock('@/features/Setting/SettingContainer', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => vi.fn(),
}));
vi.mock('@/store/serverConfig', () => ({
  serverConfigSelectors: { enableBusinessFeatures: vi.fn() },
  // The business tabs only receive the `mobile` forwarding when business
  // features are enabled, which is the configuration these cases describe.
  useServerConfigStore: () => true,
}));
vi.mock('./componentMap', () => {
  const businessPage = (tab: string) => (props: { mobile?: boolean }) => {
    businessPageSpy(tab, props);
    return createElement('div', { 'data-testid': `${tab}-page` });
  };

  return {
    componentMap: {
      appearance: () => null,
      billing: businessPage('billing'),
      credits: businessPage('credits'),
      plans: businessPage('plans'),
      referral: businessPage('referral'),
      usage: businessPage('usage'),
    },
  };
});

// Plans/Credits/Billing/Referral are compact-header tabs, so the container also
// suppresses their in-page header; Usage has a full header and only gets `mobile`.
const businessTabs = [
  [SettingsTabs.Plans, { mobile: true, showSettingHeader: false }],
  [SettingsTabs.Credits, { mobile: true, showSettingHeader: false }],
  [SettingsTabs.Billing, { mobile: true, showSettingHeader: false }],
  [SettingsTabs.Referral, { mobile: true, showSettingHeader: false }],
  [SettingsTabs.Usage, { mobile: true }],
] as const;

describe('SettingsContent mobile presentation', () => {
  beforeEach(() => {
    businessPageSpy.mockClear();
  });

  it.each(businessTabs)(
    'forwards mobile presentation to directly opened %s',
    (tab, expectedProps) => {
      render(
        <MemoryRouter>
          <SettingsContent mobile activeTab={tab} />
        </MemoryRouter>,
      );

      expect(businessPageSpy).toHaveBeenCalledWith(tab, expectedProps);
    },
  );
});
