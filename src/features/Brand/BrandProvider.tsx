'use client';

import { BRANDING_NAME } from '@lobechat/business-const';
import { createContext, type FC, type ReactNode, use, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { DEFAULT_RUNTIME_BRAND } from '@/const/brand';
import { lambdaClient } from '@/libs/trpc/client';

export interface BrandConfig {
  authTitle: string;
  copyrightText: string;
  faviconUrl: string | null;
  logoUrl: string | null;
  name: string;
  primaryColor: string | null;
  slogan: string | null;
}

const DEFAULT_BRAND: BrandConfig = {
  authTitle: DEFAULT_RUNTIME_BRAND.authTitle,
  copyrightText: DEFAULT_RUNTIME_BRAND.copyrightText,
  faviconUrl: null,
  logoUrl: DEFAULT_RUNTIME_BRAND.logoUrl,
  name: DEFAULT_RUNTIME_BRAND.name || BRANDING_NAME,
  primaryColor: DEFAULT_RUNTIME_BRAND.primaryColor,
  slogan: null,
};

const BrandContext = createContext<BrandConfig>(DEFAULT_BRAND);

const fetchBrand = async (): Promise<BrandConfig> => {
  try {
    const r = await lambdaClient.admin.settings.getPublicBrand.query();
    return {
      authTitle: (r?.authTitle && r.authTitle.trim()) || DEFAULT_BRAND.authTitle,
      copyrightText: (r?.copyrightText && r.copyrightText.trim()) || DEFAULT_BRAND.copyrightText,
      faviconUrl: r?.faviconUrl ?? null,
      logoUrl: r?.logoUrl ?? DEFAULT_BRAND.logoUrl,
      name: (r?.name && r.name.trim()) || DEFAULT_BRAND.name,
      primaryColor: r?.primaryColor ?? DEFAULT_BRAND.primaryColor,
      slogan: r?.slogan ?? null,
    };
  } catch {
    return DEFAULT_BRAND;
  }
};

const applyDocumentBrand = (b: BrandConfig) => {
  if (typeof document === 'undefined') return;
  if (b.name) document.title = b.name;
  if (b.faviconUrl) {
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = b.faviconUrl;
  }
  if (b.primaryColor) {
    document.documentElement.style.setProperty('--brand-primary', b.primaryColor);
  }
};

export const BrandProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const { data } = useSWR<BrandConfig>('brand-config', fetchBrand, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });
  const value = useMemo<BrandConfig>(() => data ?? DEFAULT_BRAND, [data]);

  useEffect(() => {
    applyDocumentBrand(value);
    i18n.options ??= {};
    i18n.options.interpolation = {
      ...i18n.options.interpolation,
      defaultVariables: {
        ...i18n.options.interpolation?.defaultVariables,
        brandName: value.name,
      },
    };
  }, [value, i18n]);

  return <BrandContext value={value}>{children}</BrandContext>;
};

export const useBrand = (): BrandConfig => use(BrandContext);
