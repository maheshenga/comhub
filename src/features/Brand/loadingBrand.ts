interface LoadingBrandLike {
  loadingText?: null | string;
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

export const buildStaticLoadingBrandHtml = (text: string) =>
  `<span style="font-size:28px;font-weight:700;color:inherit">${escapeHtml(text)}</span>`;
