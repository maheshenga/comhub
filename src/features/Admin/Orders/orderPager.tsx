'use client';

import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

interface OrderPagerProps {
  hasNext: boolean;
  hasPrevious: boolean;
  isLoading: boolean;
  onNext: () => void;
  onPrevious: () => void;
  t: TFn;
}

/** 订单列表的上一页/下一页按钮带（游标分页；ordersQuery.pager 派生）。 */
export const OrderPager = ({
  hasNext,
  hasPrevious,
  isLoading,
  t,
  onNext,
  onPrevious,
}: OrderPagerProps) => (
  <Flexbox horizontal align="center" gap={8}>
    <Button disabled={!hasPrevious} onClick={onPrevious}>
      {t('admin.pagination.previous', '上一页')}
    </Button>
    <Button disabled={!hasNext} loading={isLoading} onClick={onNext}>
      {t('admin.pagination.next', '下一页')}
    </Button>
  </Flexbox>
);
