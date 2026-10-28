import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import BusinessMobileActionBar, {
  isBusinessMobilePrimaryActionExecutable,
} from './BusinessMobileActionBar';

// tests/setup.ts 把 base-ui Button 换成原生 <button>（不透传 href）。
// 本测试断言链接 action 携带 href（role=link），恢复真实 Button 渲染 <Motion.a>。
vi.mock('@lobehub/ui', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
}));

describe('BusinessMobileActionBar', () => {
  it('renders a full-width executable primary action through a portal', () => {
    const onClick = vi.fn();
    const { container, unmount } = render(
      <BusinessMobileActionBar action={{ label: '升级套餐', onClick }} />,
    );

    const button = screen.getByRole('button', { name: '升级套餐' });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByTestId('business-mobile-action-bar')).toHaveAttribute(
      'data-safe-area',
      'true',
    );
    expect(container).toBeEmptyDOMElement();

    unmount();
    expect(screen.queryByTestId('business-mobile-action-bar')).not.toBeInTheDocument();
  });

  it('renders an executable link action', () => {
    render(<BusinessMobileActionBar action={{ href: '/settings/plans', label: '查看套餐' }} />);

    expect(screen.getByRole('link', { name: '查看套餐' })).toHaveAttribute(
      'href',
      '/settings/plans',
    );
  });

  it('rejects a fixed action without a navigation or click command', () => {
    const action = { label: '暂不可用' };

    expect(isBusinessMobilePrimaryActionExecutable(action)).toBe(false);
    render(<BusinessMobileActionBar action={action} />);
    expect(screen.queryByTestId('business-mobile-action-bar')).not.toBeInTheDocument();
  });

  it('renders nothing during SSR', () => {
    expect(
      renderToString(<BusinessMobileActionBar action={{ label: '升级套餐', onClick: vi.fn() }} />),
    ).toBe('');
  });
});
