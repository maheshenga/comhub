import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { createConfiguredHelpMenuItems } from './helpMenuItems';

describe('createConfiguredHelpMenuItems', () => {
  it('renders configured external and internal links with stable keys', () => {
    const items = createConfiguredHelpMenuItems(
      [
        {
          action: 'url',
          enabled: true,
          icon: 'book',
          key: 'docs',
          label: 'Docs',
          url: 'https://docs.example.com',
        },
        {
          action: 'url',
          enabled: true,
          icon: 'github',
          key: 'plans',
          label: 'Plans',
          url: '/settings/plans',
        },
      ],
      {
        onChangelog: vi.fn(),
        onFeedback: vi.fn(),
      },
    );

    expect(items.map((item: any) => item?.key)).toEqual(['docs', 'plans']);

    render(<MemoryRouter>{(items[0] as any).label}</MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      'https://docs.example.com',
    );

    render(<MemoryRouter>{(items[1] as any).label}</MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Plans' })).toHaveAttribute('href', '/settings/plans');
  });

  it('maps configured built-in actions to their handlers', () => {
    const onFeedback = vi.fn();
    const items = createConfiguredHelpMenuItems(
      [{ action: 'feedback', enabled: true, icon: 'feather', key: 'support', label: 'Support' }],
      {
        onChangelog: vi.fn(),
        onFeedback,
      },
    );

    expect((items[0] as any).label).toBe('Support');
    (items[0] as any).onClick();
    expect(onFeedback).toHaveBeenCalledTimes(1);
  });

  it('uses configured links before built-in action handlers', () => {
    const items = createConfiguredHelpMenuItems(
      [
        {
          action: 'product-hunt',
          enabled: true,
          icon: 'rocket',
          key: 'promo',
          label: 'Promo',
          url: 'https://promo.example.com',
        },
      ],
      { onChangelog: vi.fn(), onFeedback: vi.fn() },
    );

    render(<MemoryRouter>{(items[0] as any).label}</MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Promo' })).toHaveAttribute(
      'href',
      'https://promo.example.com',
    );
    expect((items[0] as any).onClick).toBeUndefined();
  });

  it('drops product-hunt entries without a url instead of rendering a dead menu item', () => {
    const items = createConfiguredHelpMenuItems(
      [
        { action: 'product-hunt', enabled: true, icon: 'rocket', key: 'dead', label: 'Dead' },
        { action: 'feedback', enabled: true, icon: 'feather', key: 'support', label: 'Support' },
      ],
      { onChangelog: vi.fn(), onFeedback: vi.fn() },
    );

    expect(items.map((item: any) => item?.key)).toEqual(['support']);
  });
});
