import { describe, expect, it } from 'vitest';

import { buildStaticLoadingBrandHtml, getBrandLoadingText } from './loadingBrand';

describe('loadingBrand', () => {
  it('uses only the dedicated loading text before falling back to brand name', () => {
    expect(
      getBrandLoadingText({
        loadingText: 'Loading ComHub',
        name: 'Qingyou AI',
        slogan: 'Login page copy',
      }),
    ).toBe('Loading ComHub');
    expect(getBrandLoadingText({ name: 'Qingyou AI', slogan: 'Login page copy' })).toBe(
      'Qingyou AI',
    );
    expect(getBrandLoadingText({ loadingText: '   ', name: 'Qingyou AI' })).toBe('Qingyou AI');
  });

  it('renders static loading as escaped text instead of a brand logo image', () => {
    const html = buildStaticLoadingBrandHtml('Qingyou <AI>');

    expect(html).toContain('Qingyou &lt;AI&gt;');
    expect(html).not.toContain('<img');
  });
});
