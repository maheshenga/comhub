import { describe, expect, it } from 'vitest';

import { createAuthI18n } from './createAuthI18n';

describe('createAuthI18n', () => {
  it('disables suspense so auth content can mount before translations finish loading', async () => {
    const authI18n = createAuthI18n('zh-CN');

    await authI18n.init({ initAsync: false });

    expect(authI18n.instance.options.react?.bindI18nStore).toBe('added');
    expect(authI18n.instance.options.react?.useSuspense).toBe(false);
  });
});
