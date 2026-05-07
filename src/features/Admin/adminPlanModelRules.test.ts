import { describe, expect, it } from 'vitest';

import { ADMIN_BASE_PATH } from './adminNavigation';
import { ADMIN_PLAN_MODEL_MATRIX_PATH, getPlanModelRulesSummary } from './adminPlanModelRules';

describe('adminPlanModelRules', () => {
  it('points plan model permission edits to the shared matrix page', () => {
    expect(ADMIN_PLAN_MODEL_MATRIX_PATH).toBe(`${ADMIN_BASE_PATH}/model-billing-matrix`);
  });

  it('summarizes whether a plan has model permission rules', () => {
    expect(getPlanModelRulesSummary(null)).toBe('未限制模型权限');
    expect(
      getPlanModelRulesSummary({
        chat: { allowlist: ['deepseek-chat'], mode: 'allowlist' },
        image: { blocklist: ['flux-*'], mode: 'blocklist' },
      }),
    ).toBe('已配置 2 类模型权限');
  });
});
