import { createStaticStyles, cssVar, cx } from '@lobehub/ui';
import { type TableProps } from 'antd';
// keep-antd 豁免（原 no-restricted-imports 行内豁免已随升级失效，保留原因）：InlineTable is the sanctioned antd Table wrapper for business settings pages (same role as Admin/shared/AdminDataTable): the base-ui Table is a separate tanstack-based re-implementation, and this wrapper's styles target the `.ant-table` class names its consumers rely on.
import { ConfigProvider, Table } from 'antd';
import { memo } from 'react';

const prefixCls = 'ant';

const styles = createStaticStyles(({ css }) => ({
  hoverToActive: css`
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }
  `,
  table: css`
    .${prefixCls}-table {
      background: transparent;

      th,
      td {
        border: none !important;
        font-size: 13px;
      }

      .${prefixCls}-table-cell:before {
        display: none;
      }
    }

    tr {
      td:first-child,
      th:first-child {
        padding-inline-start: 24px !important;
      }

      td:last-child,
      th:last-child {
        padding-inline-end: 24px !important;
      }
    }
  `,
}));

const InlineTable = memo<TableProps & { hoverToActive?: boolean }>(
  ({ hoverToActive, className, ...rest }) => {
    return (
      <ConfigProvider
        theme={{
          components: {
            Table: {
              headerBg: cssVar.colorFillQuaternary,
              headerBorderRadius: 0,
            },
          },
        }}
      >
        <Table
          bordered={false}
          className={cx(styles.table, hoverToActive && styles.hoverToActive, className)}
          pagination={false}
          scroll={{ x: 'max-content' }}
          size={'small'}
          {...rest}
        />
      </ConfigProvider>
    );
  },
);

export default InlineTable;
