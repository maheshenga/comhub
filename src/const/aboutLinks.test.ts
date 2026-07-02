import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ABOUT_LINKS,
  DEFAULT_ABOUT_PAGE_CONFIG,
  normalizeAboutLinksConfig,
  normalizeAboutPageConfig,
} from './aboutLinks';

describe('aboutLinks', () => {
  it('keeps default groups when saved config is missing', () => {
    expect(normalizeAboutLinksConfig(null)).toEqual(DEFAULT_ABOUT_LINKS);
  });

  it('allows admin-configured labels and links for fixed about page items', () => {
    const links = normalizeAboutLinksConfig({
      contact: [{ id: 'officialSite', label: '官网', url: 'https://chat.example.com' }],
      information: [{ id: 'github', label: '代码仓库', url: 'https://example.com/repo' }],
      legal: [{ id: 'terms', label: '用户协议', url: 'https://example.com/terms' }],
    });

    expect(links.contact.find((item) => item.id === 'officialSite')).toEqual({
      id: 'officialSite',
      label: '官网',
      url: 'https://chat.example.com',
    });
    expect(links.information.find((item) => item.id === 'github')).toEqual({
      id: 'github',
      label: '代码仓库',
      url: 'https://example.com/repo',
    });
    expect(links.legal.find((item) => item.id === 'terms')).toEqual({
      id: 'terms',
      label: '用户协议',
      url: 'https://example.com/terms',
    });
  });

  it('falls back per item when admin config is incomplete', () => {
    const links = normalizeAboutLinksConfig({
      contact: [{ id: 'officialSite', label: '', url: '' }],
    });

    expect(links.contact[0]).toEqual(DEFAULT_ABOUT_LINKS.contact[0]);
    expect(links.information).toEqual(DEFAULT_ABOUT_LINKS.information);
    expect(links.legal).toEqual(DEFAULT_ABOUT_LINKS.legal);
  });

  it('normalizes about page version links and button copy', () => {
    expect(
      normalizeAboutPageConfig({
        changelogLabel: ' Release notes ',
        changelogUrl: ' https://example.com/changelog ',
        logoLinkUrl: ' https://example.com ',
      }),
    ).toEqual({
      changelogLabel: 'Release notes',
      changelogUrl: 'https://example.com/changelog',
      logoLinkUrl: 'https://example.com',
    });

    expect(normalizeAboutPageConfig({ changelogUrl: '', logoLinkUrl: '' })).toEqual(
      DEFAULT_ABOUT_PAGE_CONFIG,
    );
  });
});
