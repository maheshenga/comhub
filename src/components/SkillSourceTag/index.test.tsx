import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SkillSourceTag from './index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'skillStore.tabs.lobehub' ? '青柚AI' : key),
  }),
}));

vi.mock('@/features/Brand', () => ({
  useBrandName: () => '玄果AI',
}));

describe('SkillSourceTag', () => {
  it('uses the configured brand label for builtin skills', () => {
    render(<SkillSourceTag source="builtin" />);

    expect(screen.getByText('玄果AI')).toBeInTheDocument();
    expect(screen.queryByText('LobeHub')).not.toBeInTheDocument();
  });
});
