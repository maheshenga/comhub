'use client';

import { BRANDING_NAME } from '@lobechat/business-const';
import { createContext, type FC, type ReactNode, use, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { DEFAULT_RUNTIME_BRAND } from '@/const/brand';
import { lambdaClient } from '@/libs/trpc/client';

export interface BrandConfig {
  authTitle: string;
  communityForkAndChatLabel: string | null;
  copyrightText: string;
  defaultSkillName: string;
  faviconUrl: string | null;
  homeMessengerBannerTitle: string | null;
  homeMessengerEnabled: boolean;
  loadingText: string | null;
  logoUrl: string | null;
  name: string;
  primaryColor: string | null;
  slogan: string | null;
}

type BrandInput = Partial<{ [K in keyof BrandConfig]: BrandConfig[K] | null }>;

const DEFAULT_BRAND: BrandConfig = {
  authTitle: DEFAULT_RUNTIME_BRAND.authTitle,
  communityForkAndChatLabel: null,
  copyrightText: DEFAULT_RUNTIME_BRAND.copyrightText,
  defaultSkillName: DEFAULT_RUNTIME_BRAND.name || BRANDING_NAME,
  faviconUrl: null,
  homeMessengerEnabled: true,
  homeMessengerBannerTitle: null,
  loadingText: DEFAULT_RUNTIME_BRAND.loadingText,
  logoUrl: DEFAULT_RUNTIME_BRAND.logoUrl,
  name: DEFAULT_RUNTIME_BRAND.name || BRANDING_NAME,
  primaryColor: DEFAULT_RUNTIME_BRAND.primaryColor,
  slogan: DEFAULT_RUNTIME_BRAND.authTitle,
};

const BrandContext = createContext<BrandConfig>(DEFAULT_BRAND);

const normalizeBrand = (brand?: BrandInput | null): BrandConfig => ({
  authTitle: (brand?.authTitle && brand.authTitle.trim()) || DEFAULT_BRAND.authTitle,
  communityForkAndChatLabel:
    (brand?.communityForkAndChatLabel && brand.communityForkAndChatLabel.trim()) ||
    DEFAULT_BRAND.communityForkAndChatLabel,
  copyrightText:
    (brand?.copyrightText && brand.copyrightText.trim()) || DEFAULT_BRAND.copyrightText,
  defaultSkillName:
    (brand?.defaultSkillName && brand.defaultSkillName.trim()) ||
    (brand?.name && brand.name.trim()) ||
    DEFAULT_BRAND.defaultSkillName,
  faviconUrl: brand?.faviconUrl ?? DEFAULT_BRAND.faviconUrl,
  homeMessengerEnabled:
    typeof brand?.homeMessengerEnabled === 'boolean'
      ? brand.homeMessengerEnabled
      : DEFAULT_BRAND.homeMessengerEnabled,
  homeMessengerBannerTitle:
    (brand?.homeMessengerBannerTitle && brand.homeMessengerBannerTitle.trim()) ||
    DEFAULT_BRAND.homeMessengerBannerTitle,
  loadingText: (brand?.loadingText && brand.loadingText.trim()) || DEFAULT_BRAND.loadingText,
  logoUrl: brand?.logoUrl ?? DEFAULT_BRAND.logoUrl,
  name: (brand?.name && brand.name.trim()) || DEFAULT_BRAND.name,
  primaryColor: brand?.primaryColor ?? DEFAULT_BRAND.primaryColor,
  slogan: (brand?.slogan && brand.slogan.trim()) || DEFAULT_BRAND.slogan,
});

const fetchBrand = async (): Promise<BrandConfig> => {
  try {
    const r = await lambdaClient.admin.settings.getPublicBrand.query();
    return normalizeBrand(r);
  } catch {
    return DEFAULT_BRAND;
  }
};

const applyDocumentBrand = (b: BrandConfig, updateDocumentTitle: boolean) => {
  if (typeof document === 'undefined') return;
  if (updateDocumentTitle && b.name) document.title = b.name;
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

export const BrandProvider: FC<{
  children: ReactNode;
  initialBrand?: BrandInput;
  updateDocumentTitle?: boolean;
}> = ({ children, initialBrand, updateDocumentTitle = true }) => {
  const { i18n } = useTranslation();
  const { data } = useSWR<BrandConfig>('brand-config', fetchBrand, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });
  const value = useMemo<BrandConfig>(
    () => data ?? normalizeBrand(initialBrand),
    [data, initialBrand],
  );

  useEffect(() => {
    applyDocumentBrand(value, updateDocumentTitle);
    i18n.options ??= {};
    i18n.options.interpolation = {
      ...i18n.options.interpolation,
      defaultVariables: {
        ...i18n.options.interpolation?.defaultVariables,
        brandName: value.name,
        defaultSkillName: value.defaultSkillName,
      },
    };
  }, [value, i18n, updateDocumentTitle]);

  return <BrandContext value={value}>{children}</BrandContext>;
};

export const useBrand = (): BrandConfig => use(BrandContext);
