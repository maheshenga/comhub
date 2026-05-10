import { BRANDING_NAME } from '@lobechat/business-const';

interface LoadingBrandLike {
  loadingText?: null | string;
  name?: null | string;
  slogan?: null | string;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const getBrandLoadingText = (
  brand: LoadingBrandLike,
  fallback: string = BRANDING_NAME,
): string => {
  const loadingText = brand.loadingText?.trim();
  if (loadingText) return loadingText;

  const name = brand.name?.trim();
  return name || fallback;
};

export const buildStaticLoadingBrandHtml = (text: string) =>
  `<span style="font-size:28px;font-weight:700;color:inherit">${escapeHtml(text)}</span>`;
