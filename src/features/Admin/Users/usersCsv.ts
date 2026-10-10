'use client';

/**
 * 用户 CSV 导出（B2 拆分自 routes/(main)/admin/users/index.tsx，字节级
 * 同逻辑迁移：header 列、转义与文件名规则保持不变）。
 */
export const exportUsersCsv = async (
  rows: Array<Record<string, unknown>>,
   
  t: any,
) => {
  const header = [
    'id',
    'email',
    'username',
    'fullName',
    'phone',
    'role',
    'banned',
    'createdAt',
    'lastActiveAt',
  ];
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'string' ? value : JSON.stringify(value);

    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [header.join(',')];
  for (const user of rows) {
    lines.push(
      [
        user.id,
        user.email,
        user.username,
        user.fullName,
        user.phone,
        user.role,
        user.banned,
        user.createdAt ? new Date(user.createdAt as string).toISOString() : '',
        user.lastActiveAt ? new Date(user.lastActiveAt as string).toISOString() : '',
      ]
        .map(escape)
        .join(','),
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
  t('admin.exportSuccess', `已导出 ${rows.length} 条`);
};
