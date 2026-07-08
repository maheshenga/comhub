/**
 * @vitest-environment happy-dom
 */
import type { PlatformPluginRunHistoryItem } from '@lobechat/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PluginRunHistory from './PluginRunHistory';

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('antd', () => {
  const Empty = ({ description }: any) => <div>{description}</div>;
  Empty.PRESENTED_IMAGE_SIMPLE = 'simple';

  return {
    Button: ({ children, loading, onClick }: any) => (
      <button aria-busy={loading} type="button" onClick={onClick}>
        {children}
      </button>
    ),
    Empty,
    Tag: ({ children }: any) => <span>{children}</span>,
    Typography: {
      Text: ({ children }: any) => <span>{children}</span>,
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const buildRun = (
  overrides: Partial<PlatformPluginRunHistoryItem>,
): PlatformPluginRunHistoryItem => ({
  artifactIds: [],
  chargedCredits: 0,
  createdAt: '2026-07-09T00:00:00.000Z',
  fixedServiceFeeCharged: false,
  pluginId: 'plugin-1',
  pluginName: 'Research Notes',
  runId: 'run-1',
  status: 'succeeded',
  ...overrides,
});

describe('PluginRunHistory', () => {
  it('localizes failed sentinel previews instead of rendering raw backend text', () => {
    render(
      <PluginRunHistory
        items={[
          buildRun({
            preview: 'platform_plugin_run_failed',
            status: 'failed',
          }),
        ]}
      />,
    );

    expect(screen.queryByText('platform_plugin_run_failed')).toBeNull();
    expect(screen.getByText('platformPlugins.run.failedPreview')).toBeTruthy();
  });

  it('keeps readable runtime previews unchanged', () => {
    render(<PluginRunHistory items={[buildRun({ preview: 'Readable runtime output' })]} />);

    expect(screen.getByText('Readable runtime output')).toBeTruthy();
  });
});
