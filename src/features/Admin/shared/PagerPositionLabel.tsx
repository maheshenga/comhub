'use client';

import { cssVar } from '@lobehub/ui';

const positionLabelStyle = {
  alignSelf: 'center',
  color: cssVar.colorTextTertiary,
  fontSize: 12,
  whiteSpace: 'nowrap',
} as const;

/**
 * 游标分页「第 N 页」位置标签（与 moduleApps CursorPager、AdminDataTable
 * pager.positionLabel 同一规范；游标分页无总页数，仅展示当前深度）。
 */
export const PagerPositionLabel = ({ label, page }: { label?: string; page?: number }) => (
  <span style={positionLabelStyle}>{label ?? `第 ${page} 页`}</span>
);
