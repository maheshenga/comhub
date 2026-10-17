// @vitest-environment node
import * as fs from 'node:fs';
import path from 'node:path';

import { MarkdownLoader } from '../index';

describe('MarkdownLoader', () => {
  it('should run', async () => {
    const content = fs.readFileSync(path.join(__dirname, `./demo.mdx`), 'utf8');

    const result = await MarkdownLoader(content);

    expect(result.length).toBeGreaterThan(0);
    for (const chunk of result) {
      expect(chunk.pageContent).toBeTruthy();
      expect(chunk.metadata.loc.lines).toBeDefined();
    }
  });
});
