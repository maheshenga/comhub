import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ModuleAppProductsPage from './ModuleAppProductsPage';

vi.mock('react-router', () => ({
  useOutletContext: () => ({ app: { id: 'app-1' }, refresh: async () => undefined }),
}));

vi.mock('../../ProductManager', () => ({
  default: ({ appId }: { appId: string }) => `Products for ${appId}`,
}));

describe('ModuleAppProductsPage', () => {
  it('always routes products through the outlet application id', () => {
    render(<ModuleAppProductsPage />);

    expect(screen.getByText('Products for app-1')).toBeInTheDocument();
  });
});
