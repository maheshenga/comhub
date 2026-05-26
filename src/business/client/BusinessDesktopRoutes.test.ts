import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ADMIN_BASE_PATH, ADMIN_NAV_GROUPS } from '@/features/Admin/adminNavigation';

const routePathFromAdminPath = (path: string) => {
  if (path === ADMIN_BASE_PATH) return "path: 'admin'";

  return `path: '${path.slice(`${ADMIN_BASE_PATH}/`.length)}'`;
};

describe('BusinessDesktopRoutes', () => {
  it('keeps every admin navigation page reachable from the settings route', async () => {
    const source = await readFile(
      join(process.cwd(), 'src/business/client/BusinessDesktopRoutes.tsx'),
      'utf8',
    );
    const adminPaths = ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.path));

    for (const path of adminPaths) {
      expect(source, `${path} is missing from BusinessDesktopRoutes`).toContain(
        routePathFromAdminPath(path),
      );
    }
  });
});
