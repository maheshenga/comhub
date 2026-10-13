'use client';

import { cssVar } from 'antd-style';

/**
 * 游标分页「第 N 页」位置标签（与 moduleApps CursorPager、AdminDataTable
 * pager.positionLabel 同一规范；游标分页无总页数，仅展示当前深度）。
 */
export const PagerPositionLabel = ({ page }: { page: number }) => (
  <span
    style={{
      alignSelf: 'center',
      color: cssVar.colorTextTertiary,
      fontSize: 12,
      whiteSpace: 'nowrap',
    }}
  >
    第 {page} 页
  </span>
);


