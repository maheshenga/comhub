import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  type FaviconState,
  FaviconProvider,
  useFaviconSetters,
} from '@/layout/GlobalProvider/FaviconProvider';

const TestSetter = ({ state }: { state: FaviconState }) => {
  const { setFavicon } = useFaviconSetters();

  useEffect(() => {
    setFavicon(state);
  }, [setFavicon, state]);

  return null;
};

describe('FaviconProvider', () => {
  beforeEach(() => {
    document.head.innerHTML = [
      '<link rel="icon" href="/_spa/favicon.ico" />',
      '<link rel="shortcut icon" href="/_spa/favicon-32x32.ico" />',
    ].join('');
  });

  it('keeps the brand favicon for the default state', async () => {
    render(
      <FaviconProvider defaultFaviconUrl="https://cdn.example.com/favicon.ico">
        <TestSetter state="default" />
      </FaviconProvider>,
    );

    await waitFor(() => {
      const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]')];
      expect(links).toHaveLength(2);
      expect(
        links.every((link) => link.getAttribute('href') === 'https://cdn.example.com/favicon.ico'),
      ).toBe(true);
    });
  });

  it('uses the upstream progress favicon for a non-default state', async () => {
    render(
      <FaviconProvider defaultFaviconUrl="https://cdn.example.com/favicon.ico">
        <TestSetter state="progress" />
      </FaviconProvider>,
    );

    await waitFor(() => {
      const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      expect(icon?.getAttribute('href')).toMatch(/^\/favicon-progress(?:-dev)?\.ico\?v=/);
    });
  });
});
