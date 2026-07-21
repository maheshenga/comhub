import { describe, expect, it } from 'vitest';

import {
  desktopBuildProfilePayloadSchema,
  desktopReleaseInputSchema,
  parseDesktopBuildProfilePayload,
} from './contract';

const validPayload = {
  applicationId: 'com.comhub.desktop',
  applicationName: 'ComHub',
  description: 'The ComHub desktop application',
  executableName: 'ComHub',
  homepage: 'https://comhub.example.com',
  installerArtifactName: 'ComHub-${version}-${arch}.${ext}',
  protocolScheme: 'comhub',
  publisher: 'ComHub',
  shortcutName: 'ComHub',
  uninstallDisplayName: 'ComHub',
};

const validRelease = {
  channel: 'stable' as const,
  profileId: '00000000-0000-0000-0000-000000000001',
  releaseNotes: '  First stable release  ',
  version: '2.4.0',
};

describe('desktop build profile contract', () => {
  it('accepts the supported Windows profile fields', () => {
    expect(parseDesktopBuildProfilePayload(validPayload)).toEqual(validPayload);
  });

  it.each(['CON', '../ComHub', 'ComHub.exe', 'ComHub/Setup'])('rejects executable %s', (name) => {
    expect(() =>
      parseDesktopBuildProfilePayload({ ...validPayload, executableName: name }),
    ).toThrow();
  });

  it('rejects unapproved artifact interpolation', () => {
    expect(() =>
      parseDesktopBuildProfilePayload({
        ...validPayload,
        installerArtifactName: '${env.HOME}-${version}.${ext}',
      }),
    ).toThrow();
  });

  it('does not retain interpolation scan state between payloads', () => {
    expect(() =>
      parseDesktopBuildProfilePayload({
        ...validPayload,
        installerArtifactName: '${version}-${env.HOME}',
      }),
    ).toThrow();
    expect(() =>
      parseDesktopBuildProfilePayload({
        ...validPayload,
        installerArtifactName: '${env.HOME}-aaaaaaaaaaaaaaaaaaaaaaaa-${version}',
      }),
    ).toThrow();
  });

  it('rejects unknown profile fields', () => {
    expect(() =>
      desktopBuildProfilePayloadSchema.parse({ ...validPayload, customBuilderKey: true }),
    ).toThrow();
  });
});

describe('desktop release input contract', () => {
  it('accepts and trims a stable SemVer 2.0 release', () => {
    expect(desktopReleaseInputSchema.parse(validRelease)).toEqual({
      ...validRelease,
      releaseNotes: 'First stable release',
    });
  });

  it('accepts a prerelease with build metadata', () => {
    expect(
      desktopReleaseInputSchema.parse({
        ...validRelease,
        channel: 'canary',
        version: '1.2.3-beta.1+build.7',
      }),
    ).toMatchObject({ channel: 'canary', version: '1.2.3-beta.1+build.7' });
  });

  it.each(['v2.4.0', '2.4', '01.2.3', '2.4.3-01', 'not-semver'])(
    'rejects invalid version %s',
    (version) => {
      expect(() => desktopReleaseInputSchema.parse({ ...validRelease, version })).toThrow();
    },
  );

  it('rejects a bad profile UUID', () => {
    expect(() =>
      desktopReleaseInputSchema.parse({ ...validRelease, profileId: 'profile-1' }),
    ).toThrow();
  });

  it('rejects oversized release notes', () => {
    expect(() =>
      desktopReleaseInputSchema.parse({ ...validRelease, releaseNotes: 'x'.repeat(10_001) }),
    ).toThrow();
  });

  it('allows empty trimmed release notes', () => {
    expect(
      desktopReleaseInputSchema.parse({ ...validRelease, releaseNotes: '   ' }).releaseNotes,
    ).toBe('');
  });

  it('rejects unknown release input fields', () => {
    expect(() =>
      desktopReleaseInputSchema.parse({ ...validRelease, revisionId: 'revision-1' }),
    ).toThrow();
  });
});
