import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('AuthThemeLite stylesheet setup', () => {
  it('keeps the upstream auth theme without custom fallback CSS', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/app/[variants]/(auth)/_layout/AuthThemeLite.tsx'),
      'utf8',
    );

    expect(source).toContain("import 'antd/dist/reset.css';");
    expect(source).not.toContain("import 'antd/dist/antd.css';");
    expect(source).not.toContain('createGlobalStyle');
    expect(source).not.toContain('AuthAntdFallbackStyle');
  });
});
