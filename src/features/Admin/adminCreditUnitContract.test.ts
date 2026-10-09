import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(path.resolve(__dirname, '../../..', relativePath), 'utf8');

describe('admin credit unit contract', () => {
  it('converts plan and top-up form values at the API boundary', () => {
    const plans = readSource('src/routes/(main)/admin/plans/index.tsx');
    const packages = readSource('src/features/Admin/AdminTopUpPackagesPage.tsx');
    // M3 split: the recharge package modal form fields moved into the
    // TopUpPackages/PackageFormFields block.
    const packageFormFields = readSource('src/features/Admin/TopUpPackages/PackageFormFields.tsx');

    for (const source of [plans, packages]) {
      expect(source).toContain('toAdminAtomicCredits');
      expect(source).toContain('toAdminDisplayCredits');
    }
    expect(packageFormFields).toContain("addonAfter={'M'}");
  });

  it('converts every general-commercial admin adjustment before submission', () => {
    const sources = [
      readSource('src/routes/(main)/admin/credits/index.tsx'),
      readSource('src/routes/(main)/admin/users/index.tsx'),
      readSource('src/features/Admin/AdminUserDetailDrawer.tsx'),
      readSource('src/routes/(main)/admin/redemption/index.tsx'),
    ];

    for (const source of sources) expect(source).toContain('toAdminAtomicCredits');
  });

  it('formats plan, order, subscription, and user detail values as M Credits', () => {
    // M3 split: order columns/drawer and the user-detail sections moved into
    // the Orders/ and UserDetail/ blocks; the page shells keep the format
    // calls they own.
    const sources = [
      readSource('src/routes/(main)/admin/plans/index.tsx'),
      readSource('src/features/Admin/AdminTopUpPackagesPage.tsx'),
      readSource('src/features/Admin/Orders/orderColumns.tsx'),
      readSource('src/features/Admin/Orders/OrderDetailDrawer.tsx'),
      readSource('src/features/Admin/AdminSubscriptionsPage.tsx'),
      readSource('src/features/Admin/UserDetail/DetailSections.tsx'),
    ];

    for (const source of sources) expect(source).toContain('formatAdminCredits');
  });
});
