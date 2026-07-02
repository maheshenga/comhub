interface LoadingBrandLike {
  loadingText?: null | string;
  loadingSvgUrl?: null | string;
  name?: null | string;
  slogan?: null | string;
}

export const GENERIC_LOADING_TEXT = '加载中';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const getBrandLoadingText = (
  _brand: LoadingBrandLike,
  _fallback: string = GENERIC_LOADING_TEXT,
): string => {
  return GENERIC_LOADING_TEXT;
};

export const buildStaticLoadingBrandHtml = (text: string, loadingSvgUrl?: null | string) => {
  const svgUrl = typeof loadingSvgUrl === 'string' ? loadingSvgUrl.trim() : '';
  const safeText = escapeHtml(text);

  if (svgUrl) {
    return `<img alt="${safeText}" data-loading-svg="true" src="${escapeHtml(svgUrl)}" style="display:block;height:40px;max-width:240px;object-fit:contain" />`;
  }

  return `<span style="font-size:28px;font-weight:700;color:inherit">${safeText}</span>`;
};
