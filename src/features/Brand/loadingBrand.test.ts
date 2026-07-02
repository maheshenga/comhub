import { describe, expect, it } from 'vitest';

import { buildStaticLoadingBrandHtml, getBrandLoadingText } from './loadingBrand';

describe('loadingBrand', () => {
  it('uses one generic loading text instead of brand or admin copy', () => {
    expect(
      getBrandLoadingText({
        loadingText: 'Loading ComHub',
        name: 'Qingyou AI',
        slogan: 'Login page copy',
      }),
    ).toBe('加载中');
    expect(getBrandLoadingText({ name: 'Qingyou AI', slogan: 'Login page copy' })).toBe('加载中');
    expect(getBrandLoadingText({ loadingText: '   ', name: 'Qingyou AI' })).toBe('加载中');
  });

  it('renders static loading as escaped text instead of a brand logo image', () => {
    const html = buildStaticLoadingBrandHtml('加载中');

    expect(html).toContain('加载中');
    expect(html).not.toContain('<img');
  });

  it('renders a configured loading SVG URL as an image while escaping attributes', () => {
    const html = buildStaticLoadingBrandHtml('Loading <ComHub>', '/branding/loading.svg?x="y"');

    expect(html).toContain('<img');
    expect(html).toContain('src="/branding/loading.svg?x=&quot;y&quot;"');
    expect(html).toContain('alt="Loading &lt;ComHub&gt;"');
    expect(html).toContain('data-loading-svg="true"');
    expect(html).not.toContain('<script');
  });
});
