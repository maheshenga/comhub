import {
  MODULE_APP_PACKAGE_MAX_SCAN_ISSUES,
  type ModuleAppPackageValidationIssue,
} from '@lobechat/types';

import type { ModuleAppZipEntry } from './zipMetadata';

const FORBIDDEN_EXTENSIONS = new Set([
  '.apk',
  '.bat',
  '.cmd',
  '.com',
  '.deb',
  '.dll',
  '.dmg',
  '.dylib',
  '.exe',
  '.msi',
  '.node',
  '.pkg',
  '.ps1',
  '.rpm',
  '.sh',
  '.so',
]);

const NESTED_ARCHIVE_EXTENSIONS = new Set([
  '.7z',
  '.bz2',
  '.gz',
  '.jar',
  '.rar',
  '.tar',
  '.tgz',
  '.xz',
  '.zip',
]);

const EICAR_SIGNATURE = new TextEncoder().encode(
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
);

const EXECUTABLE_MAGIC: number[][] = [
  [0x4D, 0x5A],
  [0x7F, 0x45, 0x4C, 0x46],
  [0xFE, 0xED, 0xFA, 0xCE],
  [0xFE, 0xED, 0xFA, 0xCF],
  [0xCE, 0xFA, 0xED, 0xFE],
  [0xCF, 0xFA, 0xED, 0xFE],
  [0xCA, 0xFE, 0xBA, 0xBE],
  [0x00, 0x61, 0x73, 0x6D],
];

const extensionOf = (path: string) => {
  const fileName = path.toLowerCase().split('/').pop() ?? '';
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot) : '';
};

const startsWith = (data: Uint8Array, prefix: number[]) =>
  data.byteLength >= prefix.length && prefix.every((value, index) => data[index] === value);

const includesBytes = (data: Uint8Array, needle: Uint8Array) => {
  if (needle.byteLength === 0 || data.byteLength < needle.byteLength) return false;

  outer: for (let offset = 0; offset <= data.byteLength - needle.byteLength; offset += 1) {
    for (let index = 0; index < needle.byteLength; index += 1) {
      if (data[offset + index] !== needle[index]) continue outer;
    }
    return true;
  }

  return false;
};

const issue = (
  code: string,
  path: string,
  message: string,
): ModuleAppPackageValidationIssue => ({ code, message, path, severity: 'error' });

export const scanModuleAppPackage = (input: {
  entries: ModuleAppZipEntry[];
  files: Record<string, Uint8Array>;
}): ModuleAppPackageValidationIssue[] => {
  const issues: ModuleAppPackageValidationIssue[] = [];
  const add = (next: ModuleAppPackageValidationIssue) => {
    if (issues.length < MODULE_APP_PACKAGE_MAX_SCAN_ISSUES) issues.push(next);
  };

  for (const entry of input.entries) {
    if (issues.length >= MODULE_APP_PACKAGE_MAX_SCAN_ISSUES) break;
    if (entry.isSymbolicLink) {
      add(
        issue(
          'module_app_package_symbolic_link',
          entry.name,
          'Symbolic links are not allowed in module app packages.',
        ),
      );
      continue;
    }
    if (entry.isEncrypted) {
      add(
        issue(
          'module_app_package_encrypted_entry',
          entry.name,
          'Encrypted ZIP entries are not allowed in module app packages.',
        ),
      );
    }
  }

  for (const [path, data] of Object.entries(input.files)) {
    if (issues.length >= MODULE_APP_PACKAGE_MAX_SCAN_ISSUES) break;
    const extension = extensionOf(path);

    if (NESTED_ARCHIVE_EXTENSIONS.has(extension)) {
      add(
        issue(
          'module_app_package_nested_archive',
          path,
          'Nested archives are not allowed in module app packages.',
        ),
      );
      continue;
    }
    if (FORBIDDEN_EXTENSIONS.has(extension)) {
      add(
        issue(
          'module_app_package_forbidden_extension',
          path,
          'Executable and command payloads are not allowed in module app packages.',
        ),
      );
      continue;
    }
    if (EXECUTABLE_MAGIC.some((magic) => startsWith(data, magic))) {
      add(
        issue(
          'module_app_package_executable_magic',
          path,
          'Executable binary content is not allowed in module app packages.',
        ),
      );
      continue;
    }
    if (includesBytes(data, EICAR_SIGNATURE)) {
      add(
        issue(
          'module_app_package_eicar_detected',
          path,
          'The package contains the EICAR antivirus test signature.',
        ),
      );
    }
  }

  return issues;
};
