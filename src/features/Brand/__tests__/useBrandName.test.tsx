/* eslint-disable */
import { renderHook } from '@testing-library/react';
import type { FC, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@lobechat/business-const', () => ({
  BRANDING_NAME: 'LobeHub',
}));

const mockUseBrand = vi.fn();
vi.mock('../BrandProvider', () => ({
  useBrand: () => mockUseBrand(),
}));

import { useBrandName } from '../useBrandName';

describe('useBrandName', () => {
  it('returns admin-configured brand name when present', () => {
    mockUseBrand.mockReturnValue({
      faviconUrl: null,
      logoUrl: null,
      name: 'Acme Inc',
      primaryColor: null,
      slogan: null,
    });
    const { result } = renderHook(() => useBrandName());
    expect(result.current).toBe('Acme Inc');
  });

  it('falls back to BRANDING_NAME when admin value is empty', () => {
    mockUseBrand.mockReturnValue({
      faviconUrl: null,
      logoUrl: null,
      name: '   ',
      primaryColor: null,
      slogan: null,
    });
    const { result } = renderHook(() => useBrandName());
    expect(result.current).toBe('LobeHub');
  });

  it('falls back to BRANDING_NAME when admin value is empty string', () => {
    mockUseBrand.mockReturnValue({
      faviconUrl: null,
      logoUrl: null,
      name: '',
      primaryColor: null,
      slogan: null,
    });
    const { result } = renderHook(() => useBrandName());
    expect(result.current).toBe('LobeHub');
  });
});
