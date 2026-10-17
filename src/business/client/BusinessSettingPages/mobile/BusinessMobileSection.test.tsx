import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BusinessMobileSection, BusinessSettingsSection } from './BusinessMobileSection';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { title?: string }) => {
      if (key === 'mobile.section.expand') return `展开 ${options?.title}`;
      if (key === 'mobile.section.collapse') return `收起 ${options?.title}`;
      return key;
    },
  }),
}));

vi.mock('@lobehub/ui/base-ui', () => ({
  FormGroup: ({
    children,
    collapsible,
    extra,
    title,
    variant,
  }: {
    children: ReactNode;
    collapsible: boolean;
    extra?: ReactNode;
    title: ReactNode;
    variant: string;
  }) => (
    <section
      data-collapsible={String(collapsible)}
      data-testid="desktop-form-group"
      data-variant={variant}
    >
      <h2>{title}</h2>
      {extra}
      {children}
    </section>
  ),
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children, gap }: { children: ReactNode; gap?: number }) => (
    <div data-flex-gap={gap} data-testid="desktop-form-gap">
      {children}
    </div>
  ),
}));

describe('BusinessMobileSection', () => {
  it('starts secondary content collapsed and exposes aria state', () => {
    render(
      <BusinessMobileSection defaultOpen={false} title="套餐对比">
        <div>comparison</div>
      </BusinessMobileSection>,
    );

    const trigger = screen.getByRole('button', { name: '展开 套餐对比' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('comparison')).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByRole('button', { name: '收起 套餐对比' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('comparison')).toBeVisible();
  });

  it('starts core content expanded by default', () => {
    render(
      <BusinessMobileSection title={<span>当前套餐</span>}>
        <div>starter</div>
      </BusinessMobileSection>,
    );

    expect(screen.getByRole('button', { name: '收起 当前套餐' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('starter')).toBeVisible();
  });

  it('supports controlled opening for anchored mobile actions', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <BusinessMobileSection
        defaultOpen={false}
        open={false}
        title="兑换码"
        onOpenChange={onOpenChange}
      >
        <div>redeem form</div>
      </BusinessMobileSection>,
    );

    fireEvent.click(screen.getByRole('button', { name: '展开 兑换码' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText('redeem form')).not.toBeInTheDocument();

    rerender(
      <BusinessMobileSection open title="兑换码" onOpenChange={onOpenChange}>
        <div>redeem form</div>
      </BusinessMobileSection>,
    );

    expect(screen.getByText('redeem form')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '收起 兑换码' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('keeps desktop sections on the existing FormGroup adapter', () => {
    render(
      <BusinessSettingsSection
        desktopExtra={<button type="button">desktop action</button>}
        title="余额"
      >
        <div>balance</div>
      </BusinessSettingsSection>,
    );

    // The 16px gap lives on the Flexbox wrapper since the base-ui FormGroup
    // dropped the root-barrel `gap` prop; the group itself keeps the rest.
    const wrapper = screen.getByTestId('desktop-form-gap');
    expect(wrapper).toHaveAttribute('data-flex-gap', '16');
    const group = screen.getByTestId('desktop-form-group');
    expect(group).toHaveAttribute('data-collapsible', 'false');
    expect(group).toHaveAttribute('data-variant', 'filled');
    expect(screen.getByRole('button', { name: 'desktop action' })).toBeVisible();
    expect(screen.getByText('balance')).toBeVisible();
  });
});
