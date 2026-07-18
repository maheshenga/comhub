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
            id: 'builtin-a',
            label: 'App A',
            order: 1,
            path: '/apps/a',
          },
          {
            enabled: false,
            icon: 'store',
            id: 'builtin-b',
            label: 'App B',
            order: 2,
            path: '/apps/b',
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
            titleOverride: 'Alpha Assistant',
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
    expect(preview).toHaveTextContent('Built-in apps: 1');
  });
});
