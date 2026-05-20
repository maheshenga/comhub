import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import { describe, expect, it } from 'vitest';

import { DEEPSEEK_V4_PRO_MODEL, DEEPSEEK_V4_PRO_PROVIDER } from './starterModels';

describe('starter models', () => {
  it('uses the admin-managed NewAPI provider in business builds instead of LobeHub', () => {
    expect(DEEPSEEK_V4_PRO_MODEL).toBe('deepseek-v4-pro');
    expect(DEEPSEEK_V4_PRO_PROVIDER).toBe(ENABLE_BUSINESS_FEATURES ? 'newapi' : 'deepseek');
  });
});
