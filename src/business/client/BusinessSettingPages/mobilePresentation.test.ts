import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const businessPages = ['Billing', 'Credits', 'Plans', 'Referral', 'Usage'];

describe('mobile business settings presentation', () => {
  it.each(businessPages)('%s uses the shared responsive page shell', async (pageName) => {
    const source = await readFile(
      path.join(process.cwd(), `src/business/client/BusinessSettingPages/${pageName}.tsx`),
      'utf8',
    );

    expect(source).toContain('BusinessSettingsPageShell');
    expect(source).toContain('mobile={mobile}');
    expect(source).not.toContain('SettingHeader');
  });
});
