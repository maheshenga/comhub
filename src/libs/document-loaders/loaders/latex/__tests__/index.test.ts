// @vitest-environment node
import * as fs from 'node:fs';
import path from 'node:path';

import { expect } from 'vitest';

import { LatexLoader } from '../index';

describe('LatexLoader', () => {
  it('should split LaTeX content into chunks', async () => {
    const content = fs.readFileSync(path.join(__dirname, `./demo.tex`), 'utf8');

    const data = await LatexLoader(content);

    expect(data.length).toBeGreaterThan(1);
    for (const chunk of data) {
      expect(chunk.pageContent).toBeTruthy();
      expect(chunk.metadata.loc.lines).toBeDefined();
    }
  });
});
