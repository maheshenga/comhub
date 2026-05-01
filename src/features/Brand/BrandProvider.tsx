'use client';

import { createContext, type FC, type ReactNode, useContext, useEffect, useMemo } from 'react';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

export interface BrandConfig {
  faviconUrl: string | null;
  logoUrl: string | null;
  name: string;
  primaryColor: string | null;
  slogan: string | null;
}

const DEFAULT_BRAND: BrandConfig = {
  faviconUrl: null,
  logoUrl: null,
  name: 'LobeHub',
  primaryColor: null,
  slogan: null,
};

const BrandContext = createContext<BrandConfig>(DEFAULT_BRAND);

const fetchBrand = async (): Promise<BrandConfig> => {
  try {
    const r = await lambdaClient.admin.settings.getPublicBrand.query();
    return {
      faviconUrl: r?.faviconUrl ?? null,
      logoUrl: r?.logoUrl ?? null,
      name: (r?.name && r.name.trim()) || DEFAULT_BRAND.name,
      primaryColor: r?.primaryColor ?? null,
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
  const { data } = useSWR<BrandConfig>('brand-config', fetchBrand, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });
  const value = useMemo<BrandConfig>(() => data ?? DEFAULT_BRAND, [data]);

  useEffect(() => {
    applyDocumentBrand(value);
  }, [value]);

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
};

export const useBrand = (): BrandConfig => useContext(BrandContext);
