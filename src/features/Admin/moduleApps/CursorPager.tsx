'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Button, Tooltip } from 'antd';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const positionLabelStyle = {
  alignSelf: 'center',
  color: 'var(--ant-color-text-tertiary)',
  fontSize: 12,
  whiteSpace: 'nowrap',
} as const;

const CursorPager = ({
  hasNext,
  hasPrevious,
  nextLabel = 'Next page',
  onNext,
  onPrevious,
  positionLabel,
  previousLabel = 'Previous page',
}: {
  hasNext?: boolean;
  hasPrevious?: boolean;
  nextLabel?: string;
  onNext?: () => void;
  onPrevious?: () => void;
  /** 游标分页没有总页数，只显示「第 N 页」（N = previousCursor 深度 + 1）。 */
  positionLabel?: string;
  previousLabel?: string;
}) => (
  <Flexbox horizontal gap={6} justify="flex-end">
    {positionLabel ? (
      <span style={positionLabelStyle}>{positionLabel}</span>
    ) : null}
    <Tooltip title={previousLabel}>
      <Button
        aria-label={previousLabel}
        disabled={!hasPrevious}
        icon={<Icon icon={ChevronLeft} size={16} />}
        style={{ height: 32, width: 32 }}
        onClick={onPrevious}
      />
    </Tooltip>
    <Tooltip title={nextLabel}>
      <Button
        aria-label={nextLabel}
        disabled={!hasNext}
        icon={<Icon icon={ChevronRight} size={16} />}
        style={{ height: 32, width: 32 }}
        onClick={onNext}
      />
    </Tooltip>
  </Flexbox>
);

export default CursorPager;
