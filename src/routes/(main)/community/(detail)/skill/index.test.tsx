// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SkillDetailPage from './index';

const mocks = vi.hoisted(() => ({
  useFetchSkillDetail: vi.fn(),
}));

vi.mock('react-router', () => ({
  useParams: () => ({ slug: 'open%2Fskill' }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('@/hooks/useQuery', () => ({
  useQuery: () => ({}),
}));

vi.mock('@/store/discover', () => ({
  useDiscoverStore: (
    selector: (state: {
      skillDetailMap: Record<string, { identifier: string }>;
      useFetchSkillDetail: typeof mocks.useFetchSkillDetail;
    }) => unknown,
  ) =>
    selector({
      skillDetailMap: { 'skill-detail-key': { identifier: 'open/skill' } },
      useFetchSkillDetail: mocks.useFetchSkillDetail,
    }),
}));

vi.mock('@/features/CommunitySkillDetail', () => ({
  SkillDetailView: () => <div data-testid="skill-details" />,
  SkillNavKey: { Install: 'install', Overview: 'overview' },
}));

vi.mock('../features/Toc/useToc', () => ({
  TocProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./features/DetailProvider', () => ({
  DetailProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./features/Header', () => ({
  default: () => <div>skill header</div>,
}));

vi.mock('./features/Details', () => ({
  default: () => <div data-testid="skill-details" />,
}));

vi.mock('./loading', () => ({
  default: () => <div>loading</div>,
}));

describe('SkillDetailPage', () => {
  it('decodes encoded community skill identifiers before fetching details', () => {
    mocks.useFetchSkillDetail.mockReturnValue({
      data: { identifier: 'open/skill' },
      isLoading: false,
      queryKey: 'skill-detail-key',
    });

    render(<SkillDetailPage />);

    expect(mocks.useFetchSkillDetail).toHaveBeenCalledWith({ identifier: 'open/skill', version: undefined });
    expect(screen.getByTestId('skill-details')).toBeInTheDocument();
  });
});
