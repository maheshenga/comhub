import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('Docker workspace manifests', () => {
  it('copies the server manifest before installing workspace dependencies', () => {
    const dockerfile = readFileSync(path.join(root, 'Dockerfile'), 'utf8');
    const installIndex = dockerfile.indexOf('pnpm i');

    expect(installIndex).toBeGreaterThan(-1);
    expect(dockerfile.slice(0, installIndex)).toMatch(
      /^COPY apps\/server\/package\.json \.\/apps\/server\/package\.json$/m,
    );
  });
});
