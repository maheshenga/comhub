import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AuthContainer from './index';

vi.mock('@lobechat/business-const', () => ({
  COPYRIGHT_FULL: '© 2026 LobeHub. All rights reserved.',
}));

vi.mock('@lobehub/ui', () => ({
  Center: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Flexbox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('antd', () => ({
  Divider: () => <span />,
}));

vi.mock('antd-style', () => ({
  cx: (...values: string[]) => values.filter(Boolean).join(' '),
}));

vi.mock('@/components/Branding', () => ({
  ProductLogo: () => <div data-testid="product-logo" />,
}));

vi.mock('@/features/Brand', () => ({
  useBrand: () => ({
    copyrightText: '© 2026 玄果AI. All rights reserved.',
  }),
}));

vi.mock('@/hooks/useIsDark', () => ({
  useIsDark: () => false,
}));

vi.mock('./AuthLangButton', () => ({
  default: () => <button type="button">Lang</button>,
}));

vi.mock('./AuthThemeButton', () => ({
  default: () => <button type="button">Theme</button>,
}));

vi.mock('./style', () => ({
  styles: {
    divider: 'divider',
    innerContainerDark: 'innerContainerDark',
    innerContainerLight: 'innerContainerLight',
    outerContainer: 'outerContainer',
  },
}));

describe('AuthContainer brand footer', () => {
  it('renders the admin configured copyright instead of the LobeHub default', () => {
    render(
      <AuthContainer>
        <div>signin form</div>
      </AuthContainer>,
    );

    expect(screen.getByText('© 2026 玄果AI. All rights reserved.')).toBeInTheDocument();
    expect(screen.queryByText('© 2026 LobeHub. All rights reserved.')).not.toBeInTheDocument();
  });
});
