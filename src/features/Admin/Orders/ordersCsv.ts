/**
 * 订单列表 CSV 导出（M5 CSV 扩面：从 AdminOrdersPage 抽出）。
 * 与 AdminDataTable 同形转义口径（RFC 4180：引号/逗号/换行包裹转义，BOM 头）。
 */
export const downloadOrdersCsv = (
  rows: Array<Record<string, any>>,
  fileNamePrefix = 'admin-orders',
) => {
  const csvColumns: Array<{ header: string; value: (row: any) => null | string | undefined }> = [
    { header: 'id', value: (row) => row.id },
    { header: 'status', value: (row) => row.status },
    { header: 'userEmail', value: (row) => row.userEmail ?? row.userName ?? row.userId },
    { header: 'amount', value: (row) => String(row.amount ?? '') },
    { header: 'currency', value: (row) => row.currency },
    { header: 'credits', value: (row) => String(row.credits ?? '') },
    { header: 'provider', value: (row) => row.provider },
    { header: 'source', value: (row) => row.source },
    { header: 'externalOrderId', value: (row) => row.externalOrderId },
    {
      header: 'createdAt',
      value: (row) => (row.createdAt ? new Date(row.createdAt).toISOString() : ''),
    },
    { header: 'paidAt', value: (row) => (row.paidAt ? new Date(row.paidAt).toISOString() : '') },
  ];
  const csvEscape = (text: string) =>
    /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  const lines = [
    csvColumns.map((column) => csvEscape(column.header)).join(','),
    ...rows.map((row) =>
      csvColumns.map((column) => csvEscape(column.value(row) ?? '')).join(','),
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileNamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};
