import { describe, expect, it } from 'vitest';

import { ADMIN_BASE_PATH } from './adminNavigation';
import { ADMIN_OVERVIEW_QUICK_LINKS } from './adminOverviewLinks';

describe('adminOverviewLinks', () => {
  it('routes model/default-model work to the shared model billing matrix', () => {
    expect(ADMIN_OVERVIEW_QUICK_LINKS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '模型与计费矩阵',
          path: `${ADMIN_BASE_PATH}/model-billing-matrix`,
        }),
      ]),
    );
    expect(ADMIN_OVERVIEW_QUICK_LINKS).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '默认模型',
          path: `${ADMIN_BASE_PATH}/model-policy`,
        }),
      ]),
    );
  });
});
