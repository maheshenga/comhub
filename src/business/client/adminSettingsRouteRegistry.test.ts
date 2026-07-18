import { describe, expect, it } from 'vitest';

import { ADMIN_SETTINGS_ROUTE_SEGMENTS } from './adminSettingsRouteRegistry';

describe('adminSettingsRouteRegistry', () => {
  it('registers the mobile admin settings route segment', () => {
    expect(ADMIN_SETTINGS_ROUTE_SEGMENTS).toContain('mobile');
  });
});
