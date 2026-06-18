import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const normalizeWhitespace = (source: string) => source.replaceAll(/\s+/g, ' ');

describe('async generation NewAPI routing', () => {
  it('passes resolved image model metadata into runtime initialization', async () => {
    const source = normalizeWhitespace(
      await readFile(join(process.cwd(), 'src/server/routers/async/image.ts'), 'utf8'),
    );

    expect(source).toContain(
      "initModelRuntimeFromDB(ctx.serverDB, ctx.userId, provider, { model: resolvedModelId, modelType: 'image', })",
    );
  });

  it('passes resolved video model metadata into runtime initialization', async () => {
    const source = normalizeWhitespace(
      await readFile(join(process.cwd(), 'src/server/routers/async/video.ts'), 'utf8'),
    );

    expect(source).toContain(
      "initModelRuntimeFromDB(ctx.serverDB, ctx.userId, provider, { model: resolvedModelId, modelType: 'video', })",
    );
  });
});
