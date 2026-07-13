import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('module worker bootstrap', () => {
  it('registers OpenTelemetry before dynamically loading database and HTTP clients', async () => {
    const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8');
    const registerAt = source.indexOf("register({ name: 'comhub-module-worker' })");
    const databaseAt = source.indexOf("import('./database')");
    const storageAt = source.indexOf("import('./s3')");

    expect(registerAt).toBeGreaterThan(-1);
    expect(databaseAt).toBeGreaterThan(registerAt);
    expect(storageAt).toBeGreaterThan(registerAt);
    expect(source).not.toMatch(/import .* from ['"]\.\/database['"]/);
    expect(source).not.toMatch(/import .* from ['"]\.\/s3['"]/);
  });
});
