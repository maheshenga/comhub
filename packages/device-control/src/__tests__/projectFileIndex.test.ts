import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { defaultGetProjectFileIndex, defaultSearchProjectFiles } from '../projectFileIndex';

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe('defaultGetProjectFileIndex', () => {
  it(
    'indexes a git repo via ls-files (tracked + untracked) with directory entries',
    async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'dc-index-git-'));
      cleanup.push(dir);
      execFileSync('git', ['-c', 'init.defaultBranch=main', 'init'], { cwd: dir });
      await mkdir(path.join(dir, 'src'), { recursive: true });
      await writeFile(path.join(dir, 'src', 'index.ts'), 'export const a = 1;\n');
      await writeFile(path.join(dir, 'README.md'), '# hi\n');
      execFileSync('git', ['add', '.'], { cwd: dir });
      // Untracked-but-not-ignored file is included via ls-files --others.
      await writeFile(path.join(dir, 'scratch.txt'), 'tmp\n');

      const result = await defaultGetProjectFileIndex({ scope: dir });

      expect(result.source).toBe('git');
      const rels = result.entries.map((e) => e.relativePath);
      expect(rels).toContain('src/index.ts');
      expect(rels).toContain('README.md');
      expect(rels).toContain('scratch.txt');
      // The intermediate directory is surfaced as its own entry.
      expect(result.entries.find((e) => e.relativePath === 'src/')?.isDirectory).toBe(true);
      expect(result.totalCount).toBe(result.entries.length);
    },
    60_000,
  );

  it('falls back to a glob walk when the scope is not a git repo', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'dc-index-glob-'));
    cleanup.push(dir);
    await mkdir(path.join(dir, 'nested', 'deep'), { recursive: true });
    await mkdir(path.join(dir, '.agents'), { recursive: true });
    await writeFile(path.join(dir, 'one.txt'), '1\n');
    await writeFile(path.join(dir, 'nested', 'deep', 'two.txt'), '2\n');
    await writeFile(path.join(dir, '.agents', 'config.md'), '# cfg\n');

    const result = await defaultGetProjectFileIndex({ scope: dir });

    expect(result.source).toBe('glob');
    const byRel = Object.fromEntries(result.entries.map((e) => [e.relativePath, e]));

    // Nested files are present and attached to synthesized directory entries.
    expect(byRel['nested/deep/two.txt']?.isDirectory).toBe(false);
    expect(byRel['nested/']?.isDirectory).toBe(true);
    expect(byRel['nested/deep/']?.isDirectory).toBe(true);

    // Dot-directories (and their files) are preserved, matching the git path.
    expect(byRel['.agents/']?.isDirectory).toBe(true);
    expect(byRel['.agents/config.md']?.isDirectory).toBe(false);

    expect(result.totalCount).toBe(result.entries.length);
  });

  it('searches project files by relative path and caps results', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'dc-search-'));
    cleanup.push(dir);
    await mkdir(path.join(dir, 'src', 'components'), { recursive: true });
    await writeFile(path.join(dir, 'src', 'components', 'Button.tsx'), 'export const Button = 1;\n');
    await writeFile(path.join(dir, 'src', 'components', 'Button.test.tsx'), 'test("button", () => {});\n');
    await writeFile(path.join(dir, 'src', 'index.ts'), 'export * from "./components/Button";\n');

    const result = await defaultSearchProjectFiles({ limit: 1, query: 'button', scope: dir });

    expect(result.source).toBe('glob');
    expect(result.totalCount).toBeGreaterThanOrEqual(2);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      isDirectory: false,
      name: 'Button.tsx',
      relativePath: 'src/components/Button.tsx',
    });
  });
});
