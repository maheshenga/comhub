import { describe, expect, it } from 'vitest';

import { getModuleAppAdminSurface } from './access';

describe('Module App admin access', () => {
  it('routes full admins to governance and finance admins to finance only', () => {
    expect(getModuleAppAdminSurface('admin')).toBe('governance');
    expect(getModuleAppAdminSurface('finance_admin')).toBe('finance');
  });

  it('does not create a Module App surface for unrelated roles', () => {
    expect(getModuleAppAdminSurface('content_admin')).toBe('none');
    expect(getModuleAppAdminSurface('support_admin')).toBe('none');
    expect(getModuleAppAdminSurface(undefined)).toBe('none');
  });
});
