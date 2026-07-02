// @vitest-environment happy-dom

import { AsyncTaskStatus } from '@lobechat/types';
import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MemoryAnalysisStatus } from './Status';

vi.mock('@lobehub/ui', () => ({
  Alert: ({ description, title }: { description?: ReactNode; title?: ReactNode }) => (
    <section>
      <h1>{title}</h1>
      <div>{description}</div>
    </section>
  ),
  Flexbox: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Icon: () => <span data-testid="icon" />,
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

vi.mock('antd', () => ({
  Progress: ({ percent }: { percent?: number }) => <div data-testid="progress">{percent}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === 'analysis.status.completedTitle') return 'Memory analysis completed';
      if (key === 'analysis.status.completed') {
        return `Processed ${values?.completed} conversations`;
      }
      return key;
    },
  }),
}));

describe('MemoryAnalysisStatus', () => {
  it('renders a recoverable success state after a task completes', () => {
    render(
      <MemoryAnalysisStatus
        task={{
          id: 'task-1',
          metadata: {
            progress: { completedTopics: 3, totalTopics: 3 },
            source: 'chat_topic',
          },
          status: AsyncTaskStatus.Success,
        }}
      />,
    );

    expect(screen.getByText('Memory analysis completed')).toBeInTheDocument();
    expect(screen.getByText('Processed 3 conversations')).toBeInTheDocument();
    expect(screen.getByTestId('progress')).toHaveTextContent('100');
  });
});
