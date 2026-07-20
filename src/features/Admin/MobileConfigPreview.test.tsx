import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type MobilePublicConfigV1 } from '@/const/mobileConfig';

import MobileConfigPreview from './MobileConfigPreview';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const config = {
  applications: {
    builtins: [
      {
        enabled: true,
        icon: 'store',
        id: 'tasks',
        label: 'Tasks',
        order: 2,
        path: '/tasks',
      },
      {
        enabled: false,
        icon: 'store',
        id: 'community',
        label: 'Community',
        order: 1,
        path: '/community',
      },
      {
        enabled: true,
        icon: 'store',
        id: 'settings',
        label: 'Settings',
        order: 1,
        path: '/settings',
      },
    ],
    featuredModuleAppIds: ['design-kit', 'copy-kit'],
  },
  brand: { displayName: 'ComHub App', logoUrl: '/brand/mobile.png' },
  design: {
    tools: [
      { enabled: true, icon: 'presentation', id: 'ppt', label: 'Slides', order: 2 },
      { enabled: false, icon: 'image', id: 'image', label: 'Images', order: 1 },
      { enabled: true, icon: 'file-text', id: 'document', label: 'Docs', order: 1 },
    ],
  },
  discover: {
    assistants: [
      {
        assistantId: 'agent-beta',
        model: 'claude-sonnet',
        order: 2,
        provider: 'anthropic',
      },
      {
        assistantId: 'agent-alpha',
        model: 'gpt-4.1',
        order: 1,
        provider: 'openai',
        titleOverride: 'Alpha Bot',
      },
    ],
    title: 'Featured',
  },
  navigation: {
    items: [
      {
        icon: 'shapes',
        id: 'slot-4',
        label: 'Apps',
        order: 4,
        path: '/apps',
        visible: true,
      },
      {
        icon: 'message-square-more',
        id: 'slot-1',
        label: 'Recent',
        order: 1,
        path: '/',
        visible: true,
      },
      {
        icon: 'compass',
        id: 'slot-3',
        label: 'Discover',
        order: 3,
        path: '/discover',
        visible: true,
      },
      {
        icon: 'palette',
        id: 'slot-2',
        label: 'Design',
        order: 2,
        path: '/design',
        visible: true,
      },
    ],
  },
  version: 1,
} satisfies MobilePublicConfigV1;

const switchMode = (mode: 'recent' | 'design' | 'discover' | 'apps') => {
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(mode, 'i') }));
};

describe('MobileConfigPreview', () => {
  it('defaults to a clearly labelled recent preview with representative row geometry', () => {
    render(<MobileConfigPreview config={config} />);

    const preview = screen.getByTestId('mobile-config-preview');
    expect(preview).toHaveStyle({ maxWidth: '360px', minHeight: '560px' });
    expect(screen.getByRole('radio', { name: /recent/i })).toBeChecked();
    expect(screen.getByTestId('mobile-preview-recent-row')).toBeInTheDocument();
    expect(preview).toHaveTextContent('Preview sample');
    expect(preview).not.toHaveTextContent(/live data/i);
  });

  it.each([
    ['recent', 'Preview sample'],
    ['design', 'Docs'],
    ['discover', 'Alpha Bot'],
    ['apps', 'Settings'],
  ] as const)('keeps configured brand and ordered navigation visible in %s mode', (mode, content) => {
    render(<MobileConfigPreview config={config} />);

    switchMode(mode);

    const preview = screen.getByTestId('mobile-config-preview');
    const navigation = screen.getByRole('navigation', { name: 'Bottom Navigation' });
    expect(preview).toHaveTextContent('ComHub App');
    expect(screen.getByRole('img', { name: 'ComHub App' })).toHaveAttribute(
      'src',
      '/brand/mobile.png',
    );
    expect(navigation).toHaveTextContent('RecentDesignDiscoverApps');
    expect(preview).toHaveTextContent(content);
  });

  it('renders only enabled design tools in configured order', () => {
    render(<MobileConfigPreview config={config} />);

    switchMode('design');

    const tools = within(screen.getByTestId('mobile-preview-design-tools')).getAllByTestId(
      'mobile-preview-grid-item',
    );
    expect(tools.map((tool) => tool.textContent)).toEqual(['Docs', 'Slides']);
    expect(screen.queryByText('Images')).not.toBeInTheDocument();
  });

  it('renders discover title overrides and provider/model metadata in configured order', () => {
    render(<MobileConfigPreview config={config} />);

    switchMode('discover');

    const assistants = within(screen.getByTestId('mobile-preview-discover-list')).getAllByTestId(
      'mobile-preview-assistant-row',
    );
    expect(assistants).toHaveLength(2);
    expect(within(assistants[0]).getByText('Alpha Bot')).toBeInTheDocument();
    expect(within(assistants[0]).getByText('openai/gpt-4.1')).toBeInTheDocument();
    expect(within(assistants[1]).getByText('agent-beta')).toBeInTheDocument();
    expect(within(assistants[1]).getByText('anthropic/claude-sonnet')).toBeInTheDocument();
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('renders enabled built-ins and featured module ids in configured order', () => {
    render(<MobileConfigPreview config={config} />);

    switchMode('apps');

    const apps = within(screen.getByTestId('mobile-preview-apps')).getAllByTestId(
      'mobile-preview-grid-item',
    );
    expect(apps.map((app) => app.textContent)).toEqual([
      'Settings',
      'Tasks',
      'design-kit',
      'copy-kit',
    ]);
    expect(screen.queryByText('Community')).not.toBeInTheDocument();
  });

  it('updates only the active visible bottom item when changing modes', () => {
    const hiddenDiscover = {
      ...config,
      navigation: {
        items: config.navigation.items.map((item) =>
          item.id === 'slot-3' ? { ...item, visible: false } : item,
        ),
      },
    } satisfies MobilePublicConfigV1;
    render(<MobileConfigPreview config={hiddenDiscover} />);

    const navigation = screen.getByRole('navigation', { name: 'Bottom Navigation' });
    expect(within(navigation).getByTestId('mobile-preview-nav-slot-1')).toHaveAttribute(
      'aria-current',
      'page',
    );

    switchMode('design');
    expect(within(navigation).getByTestId('mobile-preview-nav-slot-2')).toHaveAttribute(
      'aria-current',
      'page',
    );

    switchMode('discover');
    expect(within(navigation).queryByTestId('mobile-preview-nav-slot-3')).not.toBeInTheDocument();
    expect(navigation.querySelector('[aria-current="page"]')).toBeNull();
    expect(screen.getByTestId('mobile-preview-discover-list')).toBeInTheDocument();
  });
});
