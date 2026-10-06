import { describe, expect, it } from 'vitest';

import {
  EMPTY_DESCRIPTION_FALLBACK,
  firstText,
  normalizeCatalogItem,
  normalizeCatalogListResponse,
} from './placeholderNormalization';

describe('firstText', () => {
  it('skips placeholder and empty strings, returning the first meaningful text', () => {
    expect(firstText('UN', '  ', 'real value')).toBe('real value');
    expect(firstText(undefined, 42, 'fallback')).toBe('fallback');
    expect(firstText('UN', '')).toBeUndefined();
  });
});

describe('normalizeCatalogItem', () => {
  it('returns the same object identity when nothing needs changing', () => {
    const item = { description: 'real', icon: 'i.png', identifier: 'a.b', name: 'A B' };

    expect(normalizeCatalogItem(item)).toBe(item);
  });

  it('replaces placeholder labels and backfills the description fallback', () => {
    const normalized = normalizeCatalogItem({
      description: '',
      identifier: 'a.b',
      name: 'UN',
      title: 'UN',
    });

    expect(normalized).toMatchObject({
      description: EMPTY_DESCRIPTION_FALLBACK,
      identifier: 'a.b',
      name: 'a.b',
    });
  });

  it('drops items without any identifier source', () => {
    expect(normalizeCatalogItem({ name: 'no id' })).toBeUndefined();
  });

  it('honors a fallbackIdentifier when fields carry none', () => {
    expect(normalizeCatalogItem({ name: 'X' }, { fallbackIdentifier: 'fb.id' })).toMatchObject({
      identifier: 'fb.id',
      name: 'X',
    });
  });
});

describe('normalizeCatalogListResponse', () => {
  it('drops identifier-less rows and keeps a valid response identity', () => {
    const good = { identifier: 'keep.me', name: 'Keep' };
    const response = { items: [good, { name: 'broken row' }] };

    const normalized = normalizeCatalogListResponse(response, (item) => normalizeCatalogItem(item));

    expect(normalized).not.toBe(response);
    expect(normalized.items).toEqual([good]);
  });

  it('returns the original response when every row is already clean', () => {
    const response = { items: [{ identifier: 'a', name: 'A' }] };

    expect(normalizeCatalogListResponse(response, (item) => normalizeCatalogItem(item))).toBe(
      response,
    );
  });
});
