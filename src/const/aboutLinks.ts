import { BRANDING_EMAIL, SOCIAL_URL } from '@lobechat/business-const';

import { BLOG, mailTo, OFFICIAL_SITE, PRIVACY_URL, TERMS_URL } from '@/const/url';

export type AboutLinkId =
  | 'officialSite'
  | 'support'
  | 'business'
  | 'blog'
  | 'github'
  | 'discord'
  | 'x'
  | 'youtube'
  | 'terms'
  | 'privacy';

export type AboutLinkItem = {
  id: AboutLinkId;
  label: string;
  url: string;
};

export type AboutLinksConfig = {
  contact: AboutLinkItem[];
  information: AboutLinkItem[];
  legal: AboutLinkItem[];
};

export const DEFAULT_ABOUT_LINKS: AboutLinksConfig = {
  contact: [
    { id: 'officialSite', label: '官方网站', url: OFFICIAL_SITE },
    { id: 'support', label: '邮件支持', url: mailTo(BRANDING_EMAIL.support) },
    { id: 'business', label: '商务合作', url: mailTo(BRANDING_EMAIL.business) },
  ],
  information: [
    { id: 'blog', label: '产品博客', url: BLOG },
    { id: 'github', label: 'GitHub', url: SOCIAL_URL.github },
    { id: 'discord', label: 'Discord', url: SOCIAL_URL.discord },
    { id: 'x', label: 'X / Twitter', url: SOCIAL_URL.x },
    { id: 'youtube', label: 'YouTube', url: SOCIAL_URL.youtube },
  ],
  legal: [
    { id: 'terms', label: '服务条款', url: TERMS_URL },
    { id: 'privacy', label: '隐私政策', url: PRIVACY_URL },
  ],
};

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeGroup = (value: unknown, defaults: AboutLinkItem[]): AboutLinkItem[] => {
  const items = Array.isArray(value) ? value : [];

  return defaults.map((fallback) => {
    const matched = items.find(
      (item) => item && typeof item === 'object' && item.id === fallback.id,
    );
    const label = normalizeText((matched as Partial<AboutLinkItem> | undefined)?.label);
    const url = normalizeText((matched as Partial<AboutLinkItem> | undefined)?.url);

    return {
      id: fallback.id,
      label: label || fallback.label,
      url: url || fallback.url,
    };
  });
};

export const normalizeAboutLinksConfig = (value: unknown): AboutLinksConfig => {
  const config = value && typeof value === 'object' ? (value as Partial<AboutLinksConfig>) : {};

  return {
    contact: normalizeGroup(config.contact, DEFAULT_ABOUT_LINKS.contact),
    information: normalizeGroup(config.information, DEFAULT_ABOUT_LINKS.information),
    legal: normalizeGroup(config.legal, DEFAULT_ABOUT_LINKS.legal),
  };
};
