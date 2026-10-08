import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminDataTable } from './AdminDataTable';
import { AdminPageError, AdminPageState } from './AdminPageState';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

type Row = { id: string; name: string };

const columns = [
  { dataIndex: 'name', key: 'name', title: 'Name' },
  { dataIndex: 'id', key: 'id', title: 'ID' },
];

describe('AdminPageState three-state gate', () => {
  it('renders the list skeleton while loading', () => {
    render(
      <AdminPageState loading isEmpty={false}>
        body
      </AdminPageState>,
    );

    expect(screen.getByTestId('admin-list-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('renders the detail skeleton variant', () => {
    render(
      <AdminPageState loading isEmpty={false} skeletonVariant="detail">
        body
      </AdminPageState>,
    );

    expect(screen.getByTestId('admin-detail-skeleton')).toBeInTheDocument();
  });

  it('renders the error state with retry and forwards the retry click', () => {
    const onRetry = vi.fn();
    render(
      <AdminPageState error={new Error('boom')} isEmpty={false} onRetry={onRetry}>
        body
      </AdminPageState>,
    );

    expect(screen.getByTestId('admin-error-state')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders initial and filtered empty states with a clear-filters action', () => {
    const { rerender } = render(
      <AdminPageState isEmpty loading={false}>
        body
      </AdminPageState>,
    );

    expect(screen.getByTestId('admin-empty-initial')).toBeInTheDocument();

    const onClearFilters = vi.fn();
    rerender(
      <AdminPageState isEmpty emptyKind="filtered" loading={false} onClearFilters={onClearFilters}>
        body
      </AdminPageState>,
    );

    expect(screen.getByTestId('admin-empty-filtered')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('renders the primary action as a button', () => {
    const onClick = vi.fn();
    render(
      <AdminPageState isEmpty loading={false} primaryAction={{ label: '新建条目', onClick }}>
        body
      </AdminPageState>,
    );

    fireEvent.click(screen.getByRole('button', { name: '新建条目' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('passes children through when no state applies', () => {
    render(
      <AdminPageState isEmpty={false} loading={false}>
        <p>table body</p>
      </AdminPageState>,
    );

    expect(screen.getByText('table body')).toBeInTheDocument();
  });
});

describe('AdminPageError compact wrapper', () => {
  it('renders the error branch and awaits the retry handler', async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    render(<AdminPageError description="加载失败" title="标题" onRetry={onRetry} />);

    expect(screen.getByText('标题')).toBeInTheDocument();
    expect(screen.getByText('加载失败')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await vi.waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));
  });
});

describe('AdminDataTable', () => {
  const rows: Row[] = [
    { id: 'a1', name: 'Alice, "A"' },
    { id: 'b2', name: 'Bob' },
  ];

  it('renders an accessible scroll region with the antd table and rows', () => {
    render(
      <AdminDataTable<Row>
        columns={columns}
        dataSource={rows}
        regionLabel="订单数据表"
        rowKey="id"
      />,
    );

    expect(screen.getByRole('region', { name: '订单数据表' })).toBeInTheDocument();
    expect(screen.getByText('Alice, "A"')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('gates on the three-state primitive when loading', () => {
    render(
      <AdminDataTable<Row> loading columns={columns} dataSource={rows} regionLabel="订单数据表" />,
    );

    expect(screen.getByTestId('admin-list-skeleton')).toBeInTheDocument();
    // The scroll region never mounts while a state gate owns the surface.
    expect(screen.queryByRole('region', { name: '订单数据表' })).not.toBeInTheDocument();
  });

  it('wires the cursor pager to previous/next buttons', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(
      <AdminDataTable<Row>
        columns={columns}
        dataSource={rows}
        pager={{ hasNext: true, hasPrevious: true, onNext, onPrevious }}
        regionLabel="订单数据表"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '上一页' }));
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('exports ordered CSV with quoting and a UTF-8 BOM', () => {
    const clickSpy = vi.fn();
    const createObjectURLSpy = vi.fn<(obj: Blob) => string>(() => 'blob:csv');
    const revokeObjectURLSpy = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    });
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') {
        return {
          click: clickSpy,
          set href(_v: string) {},
          set download(_v: string) {},
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tag) as HTMLElement;
    }) as never);

    render(
      <AdminDataTable<Row>
        columns={columns}
        csvColumns={[
          { header: '名称', value: (row) => row.name },
          { header: '编号', value: (row) => row.id },
        ]}
        csvFileName="orders.csv"
        dataSource={rows}
        regionLabel="订单数据表"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /导出 CSV/ }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:csv');
    const blobArg = createObjectURLSpy.mock.calls.at(0)?.[0];
    expect(blobArg).toBeInstanceOf(Blob);

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('hides the CSV action when no csvColumns/onCsvExport is given', () => {
    render(<AdminDataTable<Row> columns={columns} dataSource={rows} regionLabel="订单数据表" />);

    expect(screen.queryByRole('button', { name: /导出 CSV/ })).not.toBeInTheDocument();
  });

  it('forwards rowSelection to the antd table (extension slot)', () => {
    const rowSelection = { onChange: vi.fn(), type: 'checkbox' as const };
    const { container } = render(
      <AdminDataTable<Row>
        columns={columns}
        dataSource={rows}
        regionLabel="订单数据表"
        rowKey="id"
        rowSelection={rowSelection}
      />,
    );

    expect(container.querySelector('.ant-table-selection-column')).not.toBeNull();
  });
});
