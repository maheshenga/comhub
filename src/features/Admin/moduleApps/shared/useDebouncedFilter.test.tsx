'use client';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useDebouncedFilter } from './useDebouncedFilter';

/**
 * useDebouncedFilter 的回写目标就是 useSearchParams（MemoryRouter 无法用
 * window.location 观察），所以挂一个把当前 search 画出来的探针组件。
 */
const Probe = ({ name, urlValue }: { name: string; urlValue: string }) => {
  const [input, setInput] = useDebouncedFilter(name, urlValue);
  const [searchParams] = useSearchParams();

  return (
    <div>
      <input
        aria-label="probe-input"
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />
      <span data-testid="probe-input-value">{input}</span>
      <span data-testid="probe-url-value">{searchParams.get(name) ?? ''}</span>
    </div>
  );
};

describe('useDebouncedFilter', () => {
  it('writes the URL only after the silent period, trimming the input', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/settings/admin/modules/apps']}>
        <Probe name="q" urlValue="" />
      </MemoryRouter>,
    );

    // 静默期内（250ms）URL 不含新值。
    await user.type(screen.getByLabelText('probe-input'), '  work  ');
    expect(screen.getByTestId('probe-url-value').textContent).toBe('');

    // 静默期后按 trim 后的值回写。
    await waitFor(() => expect(screen.getByTestId('probe-url-value').textContent).toBe('work'));
    expect(screen.getByTestId('probe-input-value').textContent).toBe('  work  ');
  });

  it('clears the parameter when the debounced input trims to empty', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/settings/admin/modules/apps?q=seed']}>
        <Probe name="q" urlValue="seed" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('probe-url-value').textContent).toBe('seed');

    await user.clear(screen.getByLabelText('probe-input'));
    await waitFor(() => expect(screen.getByTestId('probe-url-value').textContent).toBe(''));
  });

  it('starts from the URL value', () => {
    render(
      <MemoryRouter initialEntries={['/settings/admin/modules/apps?q=from-url']}>
        <Probe name="q" urlValue="from-url" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('probe-input-value').textContent).toBe('from-url');
    expect(screen.getByTestId('probe-url-value').textContent).toBe('from-url');
  });
});
