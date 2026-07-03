import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FaviconProvider, useFaviconSetters } from './FaviconProvider';

vi.mock('@/features/Brand', () => ({
  useBrand: () => ({ faviconUrl: 'https://cdn.example.com/app.ico' }),
}));

const SetDefaultFavicon = () => {
  const { setFavicon } = useFaviconSetters();

  useEffect(() => {
    setFavicon('default');
  }, [setFavicon]);

  return null;
};

describe('FaviconProvider', () => {
  it('keeps the admin configured favicon when dynamic favicon state changes', async () => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.ico?v=1">';

    render(
      <FaviconProvider>
        <SetDefaultFavicon />
      </FaviconProvider>,
    );

    await waitFor(() => {
      expect(document.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(
        'https://cdn.example.com/app.ico',
      );
    });
  });
});
