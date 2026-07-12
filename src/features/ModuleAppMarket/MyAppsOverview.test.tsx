import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ModuleAppMyAppsView } from './MyAppsOverview';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./PackageUploader', () => ({
  default: ({ onSubmitted }: { onSubmitted?: () => void }) => (
    <button onClick={onSubmitted}>moduleApps.packageUploader.submit</button>
  ),
}));

describe('ModuleAppMyAppsView', () => {
  it('renders installed apps and package review status without internal storage metadata', () => {
    const onPackageSubmitted = vi.fn();

    render(
      <ModuleAppMyAppsView
        loadingApps={false}
        loadingSubmissions={false}
        apps={[
          {
            description: 'Local services module',
            displayName: 'Classified Info',
            id: 'app-1',
            version: '1.0.0',
          },
        ]}
        submissions={[
          {
            appDisplayName: 'Talent Recruitment',
            appId: null,
            appSlug: 'talent-recruitment',
            createdAt: '2026-07-10T00:00:00.000Z',
            fileName: 'talent-recruitment.zip',
            id: 'package-1',
            packageVersion: '0.1.0',
            publishedAt: null,
            rejectionReason: null,
            reviewedAt: null,
            reviewStatus: 'pending_review',
            sizeBytes: 2048,
            updatedAt: '2026-07-10T00:00:00.000Z',
          },
        ]}
        onPackageSubmitted={onPackageSubmitted}
      />,
    );

    expect(screen.getByText('Classified Info')).toBeInTheDocument();
    expect(screen.getByText('Talent Recruitment')).toBeInTheDocument();
    expect(screen.getByText('moduleApps.submissions.status.pendingReview')).toBeInTheDocument();
    expect(screen.queryByText(/module-app-packages/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.packageUploader.submit' }));
    expect(onPackageSubmitted).toHaveBeenCalledTimes(1);
  });

  it('renders independent empty states for installed apps and submissions', () => {
    render(
      <ModuleAppMyAppsView
        apps={[]}
        loadingApps={false}
        loadingSubmissions={false}
        submissions={[]}
        onPackageSubmitted={vi.fn()}
      />,
    );

    expect(screen.getByText('moduleApps.installed.empty')).toBeInTheDocument();
    expect(screen.getByText('moduleApps.submissions.empty')).toBeInTheDocument();
  });
});
