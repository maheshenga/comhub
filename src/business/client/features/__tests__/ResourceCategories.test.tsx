import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getBusinessResourceCategories } from '../ResourceCategories';

describe('getBusinessResourceCategories (OSS stub)', () => {
  it('returns an empty array', () => {
    const { result } = renderHook(() => getBusinessResourceCategories());
    expect(result.current).toEqual([]);
  });
});
