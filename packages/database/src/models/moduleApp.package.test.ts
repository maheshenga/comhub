import { describe, expect, it, vi } from 'vitest';
import type { ModuleAppPackageArchiveMetadata, ModuleAppPackageManifest } from '@lobechat/types';

import {
  moduleAppEntitlements,
  moduleAppPackages,
  moduleApps,
  moduleAppVersions,
} from '../schemas';

import { ModuleAppModel } from './moduleApp';

const HASH = 'a'.repeat(64);

const manifest: ModuleAppPackageManifest = {
  app: {
    actions: [],
    appType: 'standard_app',
    billing: {
      chargeMode: 'free',
      defaultMultiplier: 1,
      externalApiCostCredits: 0,
      failureFixedFeePolicy: 'do_not_charge',
      fixedServiceFeeCredits: 0,
    },
    category: 'business',
    description: 'A package app.',
    displayName: 'Package App',
    icon: 'Package',
    pages: [],
    slug: 'package-app',
    source: 'developer',
    status: 'draft',
    tags: [],
  },
  entitlements: [
    {
      discountPercent: 0,
      freeQuotaCredits: 100,
      installable: true,
      plan: 'pro',
      runnable: true,
      visible: true,
    },
  ],
  manifestVersion: 1,
  packageVersion: '1.0.0',
  runtime: { kind: 'manifest_only', permissions: [] },
};

const archive: ModuleAppPackageArchiveMetadata = {
  fileName: 'package-app.zip',
  mimeType: 'application/zip',
  sha256: HASH,
  sizeBytes: 1024,
  storageKey: 'module-app-packages/package-app.zip',
};

describe('ModuleAppModel package review lifecycle', () => {
  it('creates a pending package submission', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'package-1', reviewStatus: 'pending_review' }]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as any;

    const result = await new ModuleAppModel(db).createPackageSubmission({
      archive,
      fileManifest: [{ path: 'manifest.json', sha256: HASH, sizeBytes: 512 }],
      manifest: { ...manifest, app: { ...manifest.app, source: 'system' } },
      submittedByUserId: 'user-1',
      validationReport: [],
    });

    expect(result).toEqual({ id: 'package-1', reviewStatus: 'pending_review' });
    expect(insert).toHaveBeenCalledWith(moduleAppPackages);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        archive,
        manifestSnapshot: expect.objectContaining({
          app: expect.objectContaining({
            displayName: 'Package App',
            source: 'developer',
          }),
        }),
        reviewStatus: 'pending_review',
        submittedByUserId: 'user-1',
      }),
    );
  });

  it('approves a pending package by upserting the app and linking package metadata', async () => {
    const app = { id: 'app-1', slug: 'package-app' };
    const version = { id: 'version-1', publishedAt: null, version: '1.0.0' };
    const approvedPackage = {
      appId: app.id,
      id: 'package-1',
      reviewStatus: 'approved',
      versionId: version.id,
    };

    const insertValuesByTable = new Map<unknown, unknown>();
    const updateValuesByTable = new Map<unknown, unknown>();

    const insert = vi.fn((table: unknown) => ({
      values: vi.fn((value: unknown) => {
        insertValuesByTable.set(table, value);

        return {
          returning: vi.fn(async () => {
            if (table === moduleApps) return [app];
            if (table === moduleAppVersions) return [version];
            return [];
          }),
        };
      }),
    }));
    const update = vi.fn((table: unknown) => ({
      set: vi.fn((value: unknown) => {
        updateValuesByTable.set(table, value);

        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => [approvedPackage]),
          })),
        };
      }),
    }));
    const tx = {
      delete: vi.fn(() => ({ where: vi.fn() })),
      insert,
      query: {
        moduleAppPackages: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'package-1',
            manifestSnapshot: manifest,
            reviewStatus: 'pending_review',
          }),
        },
        moduleAppVersions: {
          findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(version),
        },
        moduleApps: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      update,
    };
    const db = { transaction: vi.fn((callback) => callback(tx)) } as any;

    await expect(
      new ModuleAppModel(db).approvePackageSubmissionForAdmin({
        packageId: 'package-1',
        reviewedByUserId: 'admin-1',
      }),
    ).resolves.toMatchObject({
      appId: app.id,
      package: approvedPackage,
      slug: app.slug,
      versionId: version.id,
    });

    expect(insertValuesByTable.get(moduleApps)).toEqual(
      expect.objectContaining({
        displayName: 'Package App',
        slug: 'package-app',
        source: 'developer',
      }),
    );
    expect(insertValuesByTable.get(moduleAppEntitlements)).toEqual([
      expect.objectContaining({ appId: app.id, plan: 'pro', runnable: true }),
    ]);
    expect(updateValuesByTable.get(moduleAppPackages)).toEqual(
      expect.objectContaining({
        appId: app.id,
        reviewStatus: 'approved',
        reviewedByUserId: 'admin-1',
        versionId: version.id,
      }),
    );
  });

  it('rejects a pending package with a reviewer and reason', async () => {
    const rejectedPackage = {
      id: 'package-1',
      rejectionReason: 'Unsafe manifest',
      reviewStatus: 'rejected',
    };
    const set = vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => [rejectedPackage]),
      })),
    }));
    const tx = {
      query: {
        moduleAppPackages: {
          findFirst: vi.fn().mockResolvedValue({ id: 'package-1', reviewStatus: 'pending_review' }),
        },
      },
      update: vi.fn(() => ({ set })),
    };
    const db = { transaction: vi.fn((callback) => callback(tx)) } as any;

    await expect(
      new ModuleAppModel(db).rejectPackageSubmissionForAdmin({
        packageId: 'package-1',
        reason: 'Unsafe manifest',
        reviewedByUserId: 'admin-1',
      }),
    ).resolves.toEqual(rejectedPackage);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        rejectionReason: 'Unsafe manifest',
        reviewStatus: 'rejected',
        reviewedByUserId: 'admin-1',
      }),
    );
  });
});
