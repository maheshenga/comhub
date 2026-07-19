import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('mobile workspace touch targets', () => {
  it('keeps shared icon actions and conversation menus at least 44px', () => {
    expect(source('./MobileRefreshButton.tsx')).toContain('min-height: 44px');
    expect(source('./MobileRefreshButton.tsx')).toContain('min-width: 44px');
    expect(source('./Recent/RecentConversationRow.tsx')).toContain('blockSize: 44');
    expect(source('./Apps/index.tsx')).toContain('min-height: 44px');
    expect(source('./Apps/index.tsx')).toContain('min-width: 44px');
  });
});
