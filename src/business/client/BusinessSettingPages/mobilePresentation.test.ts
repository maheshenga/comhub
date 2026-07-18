import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const businessPages = ['Billing', 'Credits', 'Plans', 'Referral', 'Usage'];
const readBusinessPage = (pageName: string) =>
  readFile(
    path.join(process.cwd(), `src/business/client/BusinessSettingPages/${pageName}.tsx`),
    'utf8',
  );

describe('mobile business settings presentation', () => {
  it.each(businessPages)('%s uses the shared responsive page shell', async (pageName) => {
    const source = await readBusinessPage(pageName);

    expect(source).toContain('BusinessSettingsPageShell');
    expect(source).toContain('mobile={mobile}');
    expect(source).not.toContain('SettingHeader');
  });

  it('uses selectable snap cards and progressive disclosure on Plans', async () => {
    const source = await readBusinessPage('Plans');

    expect(source).toContain('getDefaultMobilePlanTarget');
    expect(source).toContain('scroll-snap-type: x mandatory');
    expect(source.match(/defaultOpen=\{false\}/g)).toHaveLength(3);
    expect(source).toContain('mobileAction={mobileAction}');
  });
});
