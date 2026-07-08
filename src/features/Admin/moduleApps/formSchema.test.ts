import { describe, expect, it } from 'vitest';

import { parseModuleAppAdminForm } from './formSchema';

describe('parseModuleAppAdminForm', () => {
  it('parses the minimum standard app editor form', () => {
    expect(
      parseModuleAppAdminForm({
        appType: 'standard_app',
        category: 'Productivity',
        description: 'A saved records app',
        displayName: 'Record Desk',
        icon: 'Notebook',
        slug: 'record-desk',
      }),
    ).toMatchObject({
      appType: 'standard_app',
      slug: 'record-desk',
      status: 'draft',
    });
  });
});
