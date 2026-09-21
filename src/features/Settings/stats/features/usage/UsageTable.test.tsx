/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { TooltipGroup } from '@lobehub/ui';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UsageRecordItem } from '@/types/usage/usageRecord';

import spend from '@/locales/default/spend';

import zhSpend from '../../../../../../locales/zh-CN/spend.json';
import UsageTable from './UsageTable';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  records: [] as UsageRecordItem[],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));
vi.mock('@lobehub/icons', () => ({
  ProviderIcon: ({ provider }: { provider: string }) => <span>{provider}</span>,
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Input: (props: Record<string, unknown>) => <input {...props} />,
  Tag: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
vi.unmock('react-i18next');

vi.mock('@/components/LobeIcons', () => ({
  ProviderIcon: ({ provider }: { provider: string }) => <span>{provider}</span>,
}));

const rows = Array.from({ length: 12 }, (_, index) => ({
  createdAt: new Date(2026, 0, index + 1).toISOString(),
  id: `row-${index + 1}`,
  model: 'gpt-5-mini',
  provider: 'openai',
  spend: index,
  totalInputTokens: index,
  totalOutputTokens: index,
  totalTokens: index * 2,
  tps: 1,
  ttft: 1,
  type: index === 0 ? 'speechRecognition' : 'chat',
}));

vi.mock('@lobehub/ui/base-ui', () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  Select: ({
    'aria-label': ariaLabel,
    options = [],
    value,
    onChange,
  }: {
    'aria-label'?: string;
    'onChange'?: (value?: string) => void;
    'options'?: Array<{ label: string; value: string }>;
    'value'?: string;
  }) => (
    <select
      aria-label={ariaLabel}
      value={value || ''}
      onChange={(event) => onChange?.(event.target.value || undefined)}
    >
      <option value="">全部类型</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('antd', () => ({
  DatePicker: Object.assign(({ children }: { children?: ReactNode }) => <div>{children}</div>, {
    RangePicker: () => <div data-testid="usage-date-range" />,
  }),
  Input: (props: Record<string, unknown>) => <input {...props} />,
  Select: ({ options = [], ...props }: { options?: Array<{ label: string; value: string }> }) => (
    <select {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('@/components/InlineTable', () => ({
  default: ({
    columns = [],
    dataSource = [],
  }: {
    columns?: Array<{ key: string; title?: ReactNode }>;
    dataSource?: UsageRecordItem[];
  }) => (
    <div data-testid="usage-table">
      {columns.map((column) => (
        <span data-testid="usage-column" key={column.key}>
          {column.title}
        </span>
      ))}
      {dataSource.map((item) => (
        <div data-testid="usage-row" key={item.id}>
          {item.model}
// Keep pagination lightweight while exercising the actual type column renderer.
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/TablePagination', () => ({
  default: ({
    current,
    onChange,
    pageSize,
  }: {
    current: number;
    onChange: (page: number, size: number) => void;
    pageSize: number;
  }) => (
    <div data-testid="usage-pagination">
      <button onClick={() => onChange(current + 1, pageSize)}>next-page</button>
      <button onClick={() => onChange(1, 10)}>resize</button>
    </div>
  ),
}));

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: () => ({
    data: mocks.records,
    error: undefined,
    isLoading: false,
    mutate: mocks.mutate,
  }),
}));

vi.mock('@/libs/swr/keys', () => ({
  statsKeys: { usageLogs: () => ['usage-logs'] },
}));

vi.mock('@/services/usage', () => ({
  usageService: { findByMonth: vi.fn() },
}));

vi.mock('@/utils/format', () => ({
  formatDate: (value: Date) => value.toISOString(),
  formatNumber: (value: number) => String(value),
}));

const makeRecord = (
  id: string,
  model: string,
  type: string,
  createdAt: string,
): UsageRecordItem => ({
  createdAt: new Date(createdAt),
  id,
  model,
  provider: 'test-provider',
  spend: 0.1,
  totalInputTokens: 10,
  totalOutputTokens: 20,
  totalTokens: 30,
  type,
  updatedAt: new Date(createdAt),
  userId: 'user-1',
});

const renderTable = () =>
  render(
    <MemoryRouter>
      <UsageTable dateStrings="2026-07" />
    </MemoryRouter>,
  );

describe('UsageTable', () => {
  beforeEach(() => {
    mocks.records = [
      makeRecord('record-1', 'claude-opus-5', 'chat', '2026-07-02T10:00:00.000Z'),
      makeRecord('record-2', 'gpt-5.4', 'image', '2026-07-03T10:00:00.000Z'),
    ];
  it.each([
    ['en-US', 'Voice Transcription'],
    ['zh-CN', '语音转写'],
  ])('renders the speech-recognition icon and label in %s', async (lng, label) => {
    const i18n = createInstance();
    await i18n.init({
      lng,
      resources: { 'en-US': { spend }, 'zh-CN': { spend: zhSpend } },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <TooltipGroup popupContainer={document.body}>
          <MemoryRouter>
            <UsageTable />
          </MemoryRouter>
        </TooltipGroup>
      </I18nextProvider>,
    );

    const cell = screen.getByTestId('type-row-1');
    expect(cell.querySelector('svg.lucide-mic')).toBeInTheDocument();
    expect(cell.querySelector('svg.lucide-circle-dot-dashed')).not.toBeInTheDocument();
    await userEvent.hover(cell.querySelector('svg')!);
    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it('moves to the next page when only the page changes', async () => {
    renderTable();
    expect(screen.getByTestId('rows')).toHaveTextContent('row-1,row-2,row-3,row-4,row-5');

    // Page and page size are written in one update. Writing them through two
    // separate query-param setters lost the page, because the second setter
    // rebuilt the URL from the params captured before the first one navigated.
    await userEvent.click(screen.getByText('next-page'));

    expect(screen.getByTestId('rows')).toHaveTextContent('row-6,row-7,row-8,row-9,row-10');
  });

  it('exposes upstream usage filters and narrows rows by model search', () => {
    renderTable();

    expect(screen.getByPlaceholderText('搜索模型')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '类型' })).toBeInTheDocument();
    expect(screen.getByTestId('usage-date-range')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置' })).toBeDisabled();
    expect(screen.getAllByTestId('usage-column').map((item) => item.textContent)).toEqual([
      '时间',
      '类型',
      '触发方式',
      '模型',
      'Token 使用量',
      'Spend',
      '消耗积分',
      '耗时',
    ]);
    expect(screen.getAllByTestId('usage-row')).toHaveLength(2);

    fireEvent.change(screen.getByPlaceholderText('搜索模型'), {
      target: { value: 'claude' },
    });

    expect(screen.getAllByTestId('usage-row')).toHaveLength(1);
    expect(screen.getByText('claude-opus-5')).toBeInTheDocument();
    expect(screen.queryByText('gpt-5.4')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重置' }));

    expect(screen.getByPlaceholderText('搜索模型')).toHaveValue('');
    expect(screen.getAllByTestId('usage-row')).toHaveLength(2);
  });

  it('updates page and page size together without losing the requested page', () => {
    mocks.records = Array.from({ length: 12 }, (_, index) =>
      makeRecord(`row-${index + 1}`, `model-${index + 1}`, 'chat', '2026-07-02T10:00:00.000Z'),
    );
    renderTable();

    expect(screen.getAllByTestId('usage-row').map((row) => row.textContent)).toEqual([
      'model-1', 'model-2', 'model-3', 'model-4', 'model-5',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'next-page' }));

    expect(screen.getAllByTestId('usage-row').map((row) => row.textContent)).toEqual([
      'model-6', 'model-7', 'model-8', 'model-9', 'model-10',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'resize' }));

    expect(screen.getAllByTestId('usage-row')).toHaveLength(10);
    expect(screen.getAllByTestId('usage-row')[0]).toHaveTextContent('model-1');
  });
});
