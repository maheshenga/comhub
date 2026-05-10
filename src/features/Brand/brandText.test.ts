import { describe, expect, it } from 'vitest';

import { replaceLegacyBrandTokens } from './brandText';

describe('replaceLegacyBrandTokens', () => {
  it('replaces legacy Lobe brand spellings with the configured brand name', () => {
    expect(replaceLegacyBrandTokens('为 LobeAI 添加渠道', '玄果AI')).toBe('为 玄果AI 添加渠道');
    expect(replaceLegacyBrandTokens('Ask Lobe AI', '玄果AI')).toBe('Ask 玄果AI');
    expect(replaceLegacyBrandTokens('LobeHub Skills', '玄果AI')).toBe('玄果AI Skills');
  });
});
