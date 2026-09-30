import { useBrand } from './BrandProvider';

/**
 * ComHub brand resolution helpers for upstream-owned components.
 *
 * Upstream components (ProductLogo, BrandWatermark, BrandTextLoading) call
 * these hooks instead of inlining ComHub branching, so an upstream rewrite of
 * those components only has to re-thread one hook call and this module owns
 * all fallback logic. The commercial-licensed
 * packages/business/const/src/branding.ts is never modified — branding flows
 * only through the runtime brand seam.
 */

const UPSTREAM_BRAND_NAME = 'LobeHub';

export interface RuntimeBrandResolution {
  /** Runtime-configured favicon URL, if any. */
  faviconUrl?: null | string;
  /** True when runtime brand settings (admin config or built-in defaults) are active. */
  isRuntimeBranded: boolean;
  /** Runtime-configured logo URL, if any. */
  logoUrl?: null | string;
  /** The brand name to render. */
  name: string;
}

/**
 * Resolve the effective runtime brand for attribution/logo components.
 * `isRuntimeBranded` is true when the brand differs from upstream defaults,
 * meaning the product brand (not the upstream attribution) should render.
 * (Upstream's build-time `isCustomORG` switch is ORed in by the caller — this
 * hook only covers the runtime seam.)
 */
export const useRuntimeBrand = (): RuntimeBrandResolution => {
  const brand = useBrand();

  const isRuntimeBranded = Boolean(brand.logoUrl) || brand.name !== UPSTREAM_BRAND_NAME;

  return {
    faviconUrl: brand.faviconUrl,
    isRuntimeBranded,
    logoUrl: brand.logoUrl,
    name: brand.name,
  };
};
