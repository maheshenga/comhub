import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type MobilePublicConfigV1 } from '@/const/mobileConfig';

import MobileConfigPreview from './MobileConfigPreview';

describe('MobileConfigPreview', () => {
  it('renders brand and normalized visible counts with stable preview dimensions', () => {
    const config: MobilePublicConfigV1 = {
      applications: {
        builtins: [
          {
            enabled: true,
            icon: 'store',
            id: 'tasks',
            label: 'App A',
            order: 1,
            path: '/tasks',
          },
          {
            enabled: false,
            icon: 'store',
            id: 'community',
            label: 'App B',
            order: 2,
            path: '/community',
          },
        ],
        featuredModuleAppIds: ['design-kit'],
      },
      brand: { displayName: 'ComHub App', logoUrl: '/brand/mobile.png' },
      design: {
        tools: [
          { enabled: true, icon: 'file-text', id: 'document', label: 'Docs', order: 1 },
          { enabled: false, icon: 'image', id: 'image', label: 'Images', order: 2 },
          { enabled: true, icon: 'presentation', id: 'ppt', label: 'PPT', order: 3 },
        ],
      },
      discover: {
        assistants: [
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
            icon: 'message-square-more',
            id: 'slot-1',
            label: 'Chats',
            order: 1,
            path: '/',
            visible: true,
          },
          {
            icon: 'palette',
            id: 'slot-2',
            label: 'Design',
            order: 2,
            path: '/design',
            visible: false,
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
            icon: 'shapes',
            id: 'slot-4',
            label: 'Apps',
            order: 4,
            path: '/apps',
            visible: true,
          },
        ],
      },
      version: 1,
    };

    render(<MobileConfigPreview config={config} />);

    const preview = screen.getByTestId('mobile-config-preview');
    expect(preview).toHaveStyle({ maxWidth: '360px', minHeight: '520px' });
    expect(preview).toHaveTextContent('ComHub App');
    expect(preview).toHaveTextContent('Visible tabs: 3');
    expect(preview).toHaveTextContent('Enabled tools: 2');
    expect(preview).toHaveTextContent('Assistants: 1');
    expect(preview).toHaveTextContent('Module apps: 1');
    expect(preview).toHaveTextContent('Built-in apps: 5');
  });

  it('uses a non-section root and renders normalized content from every mobile category', () => {
    const config = {
      applications: {
        builtins: [
          {
            enabled: true,
            icon: 'store',
            id: 'tasks',
            label: 'App A',
            order: 1,
            path: '/tasks',
          },
          {
            enabled: false,
            icon: 'sparkles',
            id: 'community',
            label: 'App B',
            order: 2,
            path: '/community',
          },
        ],
        featuredModuleAppIds: ['design-kit', 'copy-kit'],
      },
      brand: { displayName: 'ComHub App', logoUrl: '/brand/mobile.png' },
      design: {
        tools: [
          { enabled: true, icon: 'file-text', id: 'document', label: 'Docs', order: 1 },
          { enabled: false, icon: 'image', id: 'image', label: 'Images', order: 2 },
          { enabled: true, icon: 'presentation', id: 'ppt', label: 'Slides', order: 3 },
        ],
      },
      discover: {
        assistants: [
          {
            assistantId: 'agent-alpha',
            model: 'gpt-4.1',
            order: 1,
            provider: 'openai',
            titleOverride: 'Alpha Bot',
          },
          {
            assistantId: 'agent-beta',
            model: 'claude-sonnet',
            order: 2,
            provider: 'anthropic',
          },
        ],
        title: 'Featured',
      },
      navigation: {
        items: [
          {
            icon: 'message-square-more',
            id: 'slot-1',
            label: 'Chats',
            order: 1,
            path: '/',
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
          {
            icon: 'compass',
            id: 'slot-3',
            label: 'Discover',
            order: 3,
            path: '/discover',
            visible: false,
          },
          {
            icon: 'shapes',
            id: 'slot-4',
            label: 'Apps',
            order: 4,
            path: '/apps',
            visible: true,
          },
        ],
      },
      version: 1,
    } satisfies MobilePublicConfigV1;

    render(<MobileConfigPreview config={config} />);

    const preview = screen.getByTestId('mobile-config-preview');
    expect(preview.tagName).toBe('DIV');
    expect(preview).toHaveTextContent('ComHub App');
    expect(preview).toHaveTextContent('/brand/mobile.png');
    expect(preview).toHaveTextContent('Chats');
    expect(preview).toHaveTextContent('message-square-more');
    expect(preview).toHaveTextContent('Docs');
    expect(preview).toHaveTextContent('file-text');
    expect(preview).toHaveTextContent('Slides');
    expect(preview).toHaveTextContent('presentation');
    expect(preview).toHaveTextContent('Alpha Bot');
    expect(preview).toHaveTextContent('agent-beta');
    expect(preview).toHaveTextContent('design-kit');
    expect(preview).toHaveTextContent('copy-kit');
    expect(preview).toHaveTextContent('App A');
    expect(preview).toHaveTextContent('store');
    expect(preview).not.toHaveTextContent('Images');
    expect(preview).not.toHaveTextContent('App B');
    expect(preview).not.toHaveTextContent('Discover');
  });
});
