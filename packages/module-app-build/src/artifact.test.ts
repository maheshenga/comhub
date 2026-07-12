import { describe, expect, it } from 'vitest';

import {
  buildDeterministicModuleAppArtifact,
  inspectModuleAppArtifact,
} from '@lobechat/module-app-build';

const encoder = new TextEncoder();

const reverseObject = <T>(value: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(value).reverse());

describe('module app artifacts', () => {
  it('builds a byte-stable canonical archive and reports canonical headers', async () => {
    const files = {
      'dist/assets/app.js': encoder.encode('console.log("hello");'),
      'dist/index.html': encoder.encode('<main>Hello</main>'),
      'module-app.yaml': encoder.encode('manifestVersion: 2\n'),
    };

    const first = await buildDeterministicModuleAppArtifact({ files });
    const second = await buildDeterministicModuleAppArtifact({ files: reverseObject(files) });

    expect(second.bytes).toEqual(first.bytes);
    expect(second.sha256).toBe(first.sha256);

    const entries = await inspectModuleAppArtifact(first.bytes);

    expect(entries.map((entry) => entry.path)).toEqual([
      'dist',
      'dist/assets',
      'dist/assets/app.js',
      'dist/index.html',
      'module-app.yaml',
    ]);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gid: 0,
          gname: '',
          mode: 0o555,
          mtime: new Date(0),
          path: 'dist',
          type: 'directory',
          uid: 0,
          uname: '',
        }),
        expect.objectContaining({
          gid: 0,
          gname: '',
          mode: 0o444,
          mtime: new Date(0),
          path: 'dist/index.html',
          type: 'file',
          uid: 0,
          uname: '',
        }),
      ]),
    );
  });

  it.each(['../secret.txt', '/absolute.txt', 'C:\\absolute.txt', 'dist\\index.html'])(
    'rejects unsafe input path %s',
    async (path) => {
      await expect(
        buildDeterministicModuleAppArtifact({ files: { [path]: encoder.encode('unsafe') } }),
      ).rejects.toMatchObject({ code: 'module_app_package_unsafe_path' });
    },
  );
});
