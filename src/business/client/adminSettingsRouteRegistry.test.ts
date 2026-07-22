import { describe, expect, it } from 'vitest';

import {
  ADMIN_SETTINGS_ROUTE_REGISTRY,
  ADMIN_SETTINGS_ROUTE_SEGMENTS,
} from './adminSettingsRouteRegistry';

describe('adminSettingsRouteRegistry', () => {
  it('registers the mobile admin settings route segment', () => {
    expect(ADMIN_SETTINGS_ROUTE_SEGMENTS).toContain('mobile');
  });

  it('keeps the overview as the registry index route', () => {
    expect(ADMIN_SETTINGS_ROUTE_REGISTRY.find((route) => route.id === 'overview')).toMatchObject({
      index: true,
    });
  });
});
