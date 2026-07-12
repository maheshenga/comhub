'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Button, Tooltip } from 'antd';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CursorPager = ({
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
}: {
  hasNext?: boolean;
  hasPrevious?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
}) => (
  <Flexbox horizontal gap={6} justify="flex-end">
    <Tooltip title="Previous page">
      <Button
        aria-label="Previous page"
        disabled={!hasPrevious}
        icon={<Icon icon={ChevronLeft} size={16} />}
        style={{ height: 32, width: 32 }}
        onClick={onPrevious}
      />
    </Tooltip>
    <Tooltip title="Next page">
      <Button
        aria-label="Next page"
        disabled={!hasNext}
        icon={<Icon icon={ChevronRight} size={16} />}
        style={{ height: 32, width: 32 }}
        onClick={onNext}
      />
    </Tooltip>
  </Flexbox>
);

export default CursorPager;
