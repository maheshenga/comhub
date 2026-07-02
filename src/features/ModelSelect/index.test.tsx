import { render, screen } from '@testing-library/react';
import type { PropsWithChildren, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import ModelSelect from './index';

const state = {
  enabledList: [] as any[],
};

vi.mock('@/hooks/useEnabledChatModels', () => ({
  useEnabledChatModels: () => state.enabledList,
}));

vi.mock('@lobehub/ui', () => ({
  TooltipGroup: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('@lobehub/ui/base-ui', () => ({
  Select: ({ options = [], value }: { options?: any[]; value?: string }) => {
    const flatten = (items: any[]): any[] =>
      items.flatMap((item) => (Array.isArray(item?.options) ? flatten(item.options) : [item]));
    const selected = flatten(options).find((item) => item.value === value);

    return <div data-testid="select-value">{selected?.label ?? value}</div>;
  },
}));

vi.mock('@/components/ModelSelect', () => ({
  ModelItemRender: ({ displayName, id }: { displayName?: string; id: string }) => (
    <span>{displayName || id}</span>
  ),
  ProviderItemRender: ({ name }: { name: string }) => <span>{name}</span>,
  TAG_CLASSNAME: 'model-info-tags',
}));

describe('ModelSelect', () => {
  it('renders a readable selected model when the saved provider is an instance id', () => {
    state.enabledList = [
      {
        children: [
          {
            abilities: {},
            displayName: 'DeepSeek V4 Pro',
            id: 'deepseek-v4-pro',
          },
        ],
        id: 'opencode-go',
        name: 'opencode Go',
        source: 'custom',
      },
    ];

    render(
      <ModelSelect
        showAbility={false}
        value={{
          model: 'deepseek-v4-pro',
          provider: '757e1732-8478-4c93-a4dd-1e17489a9c48',
        }}
      />,
    );

    const selected = screen.getByTestId('select-value');

    expect(selected).toHaveTextContent('DeepSeek V4 Pro');
    expect(selected).not.toHaveTextContent('757e1732-8478-4c93-a4dd-1e17489a9c48');
  });
});
