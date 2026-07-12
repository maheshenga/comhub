import { describe, expect, it } from 'vitest';

import { scanModuleAppPackage } from './scanner';
import type { ModuleAppZipEntry } from './zipMetadata';

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

const scan = (
  files: Record<string, Uint8Array>,
  entries: ModuleAppZipEntry[] = Object.keys(files).map((name) => ({
    isEncrypted: false,
    isSymbolicLink: false,
    name,
  })),
) => scanModuleAppPackage({ entries, files });

describe('scanModuleAppPackage', () => {
  it.each([
    ['eicar.txt', text('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'), 'module_app_package_eicar_detected'],
    ['pe.bin', bytes(0x4D, 0x5A, 0x90, 0x00), 'module_app_package_executable_magic'],
    ['elf.bin', bytes(0x7F, 0x45, 0x4C, 0x46), 'module_app_package_executable_magic'],
    ['macho.bin', bytes(0xFE, 0xED, 0xFA, 0xCF), 'module_app_package_executable_magic'],
    ['module.wasm', bytes(0x00, 0x61, 0x73, 0x6D), 'module_app_package_executable_magic'],
    ['install.ps1', text('Write-Host unsafe'), 'module_app_package_forbidden_extension'],
    ['payload.zip', bytes(0x50, 0x4B, 0x03, 0x04), 'module_app_package_nested_archive'],
  ])('blocks %s with %s', (path, data, code) => {
    expect(scan({ [path]: data })).toEqual([expect.objectContaining({ code, path })]);
  });

  it('blocks Unix symlinks and encrypted entries before review', () => {
    expect(
      scan(
        { 'link.txt': text('target') },
        [{ isEncrypted: false, isSymbolicLink: true, name: 'link.txt', unixMode: 0xA1FF }],
      ),
    ).toEqual([
      expect.objectContaining({ code: 'module_app_package_symbolic_link', path: 'link.txt' }),
    ]);

    expect(
      scan(
        { 'secret.txt': text('secret') },
        [{ isEncrypted: true, isSymbolicLink: false, name: 'secret.txt' }],
      ),
    ).toEqual([
      expect.objectContaining({ code: 'module_app_package_encrypted_entry', path: 'secret.txt' }),
    ]);
  });

  it('allows ordinary frontend static assets', () => {
    expect(
      scan({
        'app/index.html': text('<main>App</main>'),
        'app/main.css': text('main { display: block; }'),
        'app/main.js': text('export const value = 1;'),
        'app/meta.json': text('{"ok":true}'),
        'app/readme.md': text('# App'),
        'assets/font.woff2': bytes(0x77, 0x4F, 0x46, 0x32),
        'assets/icon.png': bytes(0x89, 0x50, 0x4E, 0x47),
      }),
    ).toEqual([]);
  });

  it('bounds persisted issue output', () => {
    const files = Object.fromEntries(
      Array.from({ length: 120 }, (_, index) => [`scripts/${index}.cmd`, text('echo unsafe')]),
    );

    expect(scan(files)).toHaveLength(100);
  });
});
