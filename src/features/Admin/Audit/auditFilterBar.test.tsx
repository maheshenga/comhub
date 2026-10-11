import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { AuditFilterKey } from '@/features/Admin/Audit/auditParts';

import { AuditFilterBar } from './auditFilterBar';

const t = (key: string, fallback?: string) => fallback ?? key;

/**
 * Harness that owns the applied filters, the way AdminAuditPage does: the
 * parent holds `appliedByKey` and only changes it from onFilterChange.
 */
const Harness = ({
  onFilterChangeSpy,
}: {
  onFilterChangeSpy?: (k: AuditFilterKey, v: string) => void;
}) => {
  const [applied, setApplied] = useState<Record<string, string>>({});

  return (
    <AuditFilterBar
      actionFilter={applied.action ?? ''}
      actorFilter={applied.actorUserId ?? ''}
      batchFilter={applied.batchCorrelationId ?? ''}
      dateRangeFilter={null}
      exporting={false}
      resourceIdFilter={applied.resourceId ?? ''}
      resourceTypeFilter={applied.resourceType ?? ''}
      t={t}
      targetFilter={applied.targetUserId ?? ''}
      onDateRangeChange={vi.fn()}
      onExport={vi.fn()}
      onFilterChange={(key, value) => {
        onFilterChangeSpy?.(key, value);
        setApplied((current) => ({ ...current, [key]: value }));
      }}
    />
  );
};

const actorInput = () => screen.getByPlaceholderText('操作者用户 ID') as HTMLInputElement;
const actionInput = () => screen.getByPlaceholderText('操作（如 user.ban）') as HTMLInputElement;

describe('AuditFilterBar draft commit', () => {
  it('does not query on every keystroke — only on Enter or blur', () => {
    const spy = vi.fn();
    render(<Harness onFilterChangeSpy={spy} />);

    fireEvent.change(actorInput(), { target: { value: 'u' } });
    fireEvent.change(actorInput(), { target: { value: 'us' } });
    fireEvent.change(actorInput(), { target: { value: 'usr' } });
    expect(spy, 'typing must not fire a query per character').not.toHaveBeenCalled();

    fireEvent.keyDown(actorInput(), { key: 'Enter', code: 'Enter' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('actorUserId', 'usr');
  });

  it('commits on blur', () => {
    const spy = vi.fn();
    render(<Harness onFilterChangeSpy={spy} />);

    fireEvent.change(actorInput(), { target: { value: 'user-42' } });
    fireEvent.blur(actorInput());
    expect(spy).toHaveBeenCalledWith('actorUserId', 'user-42');
  });

  it('clearing a box commits immediately (explicit intent)', () => {
    const spy = vi.fn();
    render(<Harness onFilterChangeSpy={spy} />);

    fireEvent.change(actorInput(), { target: { value: 'user-42' } });
    fireEvent.keyDown(actorInput(), { key: 'Enter', code: 'Enter' });
    spy.mockClear();

    fireEvent.change(actorInput(), { target: { value: '' } });
    expect(spy).toHaveBeenCalledWith('actorUserId', '');
  });

  it('does not clobber another box’s uncommitted draft when one filter changes externally', () => {
    const spy = vi.fn();
    render(<Harness onFilterChangeSpy={spy} />);

    // Type into the actor box but do NOT commit it.
    fireEvent.change(actorInput(), { target: { value: 'half-typed' } });

    // Now commit a *different* box. Its parent update re-renders the bar with
    // a new appliedByKey, which fires the sync effect. An earlier whole-object
    // setDrafts(appliedByKey) would wipe 'half-typed' back to ''.
    fireEvent.change(actionInput(), { target: { value: 'user.ban' } });
    fireEvent.keyDown(actionInput(), { key: 'Enter', code: 'Enter' });

    expect(actorInput().value, 'the uncommitted draft must survive').toBe('half-typed');
  });
});
