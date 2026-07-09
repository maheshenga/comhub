import { describe, expect, it } from 'vitest';

import {
  moduleAppActionConfigSchema,
  moduleAppAdminUpsertSchema,
  moduleAppPackageArchiveMetadataSchema,
  moduleAppPackageManifestSchema,
  moduleAppPackageSubmitSchema,
  moduleAppBillingConfigSchema,
  moduleAppMarketplaceListInputSchema,
  moduleAppPageSchema,
  moduleAppRecordInputSchema,
  moduleAppRuntimeTypeSchema,
} from './moduleApp';

describe('module app type contracts', () => {
  it('accepts standard app pages and record actions', () => {
    expect(
      moduleAppPageSchema.parse({
        key: 'records',
        routePath: '/records',
        title: 'Records',
        type: 'list',
      }),
    ).toMatchObject({ key: 'records', type: 'list' });

    expect(
      moduleAppActionConfigSchema.parse({
        id: 'create_record',
        inputSchema: { fields: [{ key: 'title', label: 'Title', required: true, type: 'text' }] },
        name: 'Create record',
        runtimeType: 'record_create',
      }),
    ).toMatchObject({ id: 'create_record', runtimeType: 'record_create' });
  });

  it('keeps unsafe P1 runtimes out of the runtime enum', () => {
    expect(() => moduleAppRuntimeTypeSchema.parse('external_js')).toThrow();
    expect(() => moduleAppRuntimeTypeSchema.parse('iframe')).toThrow();
    expect(() => moduleAppRuntimeTypeSchema.parse('mcp')).toThrow();
    expect(() => moduleAppRuntimeTypeSchema.parse('skill')).toThrow();
  });

  it('defaults billing to free CRUD semantics', () => {
    expect(moduleAppBillingConfigSchema.parse({})).toEqual({
      chargeMode: 'free',
      defaultMultiplier: 1,
      externalApiCostCredits: 0,
      failureFixedFeePolicy: 'do_not_charge',
      fixedServiceFeeCredits: 0,
    });
  });

  it('parses admin app definitions with multiple pages and actions', () => {
    const input = moduleAppAdminUpsertSchema.parse({
      appType: 'standard_app',
      billing: {},
      category: 'Productivity',
      description: 'Simple saved records app',
      displayName: 'Record Desk',
      icon: 'Notebook',
      pages: [
        { key: 'overview', routePath: '/', title: 'Overview', type: 'overview' },
        { key: 'records', routePath: '/records', title: 'Records', type: 'list' },
      ],
      actions: [
        {
          id: 'create_record',
          inputSchema: { fields: [] },
          name: 'Create',
          runtimeType: 'record_create',
        },
      ],
      slug: 'record-desk',
      status: 'draft',
      tags: ['records'],
    });

    expect(input.pages).toHaveLength(2);
    expect(input.actions).toHaveLength(1);
  });

  it('normalizes optional list and record inputs', () => {
    expect(moduleAppMarketplaceListInputSchema.parse({ query: '  desk  ' })).toEqual({
      query: 'desk',
    });

    expect(
      moduleAppRecordInputSchema.parse({
        appId: '00000000-0000-4000-8000-000000000001',
        collectionKey: 'records',
        data: { title: 'A' },
        scopeType: 'personal',
      }),
    ).toMatchObject({ collectionKey: 'records', scopeType: 'personal' });
  });

  it('parses package manifests with app metadata, billing, pages, actions, and entitlements', () => {
    const manifest = moduleAppPackageManifestSchema.parse({
      app: {
        actions: [
          {
            id: 'create_listing',
            inputSchema: { fields: [] },
            name: 'Create listing',
            runtimeType: 'record_create',
          },
        ],
        appType: 'standard_app',
        billing: {
          chargeMode: 'fixed',
          defaultMultiplier: 1.35,
          externalApiCostCredits: 0,
          failureFixedFeePolicy: 'do_not_charge',
          fixedServiceFeeCredits: 20,
        },
        category: 'local-services',
        description: 'A classified information module package.',
        displayName: 'Classified Info',
        icon: 'Newspaper',
        pages: [{ key: 'listings', routePath: '/listings', title: 'Listings', type: 'list' }],
        slug: 'classified-info',
        tags: ['classified'],
      },
      entitlements: [
        {
          installable: true,
          plan: 'pro',
          runnable: true,
          visible: true,
        },
      ],
      manifestVersion: 1,
      packageVersion: '1.0.0',
      runtime: {
        entry: 'app/index.html',
        kind: 'frontend_static',
        permissions: ['storage.records', 'billing.charge'],
      },
    });

    expect(manifest.app.displayName).toBe('Classified Info');
    expect(manifest.entitlements[0]).toMatchObject({
      installable: true,
      plan: 'pro',
      runnable: true,
      visible: true,
    });
    expect(manifest.runtime.kind).toBe('frontend_static');
  });

  it('rejects server container runtime declarations in package manifests for P1', () => {
    expect(() =>
      moduleAppPackageManifestSchema.parse({
        app: {
          actions: [],
          appType: 'hybrid_app',
          billing: {},
          category: 'enterprise',
          description: 'Server container module.',
          displayName: 'Server Module',
          icon: 'Server',
          pages: [],
          slug: 'server-module',
          tags: [],
        },
        manifestVersion: 1,
        packageVersion: '1.0.0',
        runtime: {
          entry: 'server/index.js',
          kind: 'server_container',
          permissions: ['network.external'],
        },
      }),
    ).toThrow();
  });

  it('parses submitted package archive metadata', () => {
    const input = moduleAppPackageSubmitSchema.parse({
      archive: {
        fileName: 'classified-info.zip',
        mimeType: 'application/zip',
        sha256: 'a'.repeat(64),
        sizeBytes: 1024,
        storageKey: 'module-app-packages/user-1/classified-info.zip',
      },
      fileManifest: [{ path: 'manifest.json', sizeBytes: 512 }],
      manifest: {
        app: {
          actions: [],
          appType: 'standard_app',
          billing: {},
          category: 'local-services',
          description: 'A classified information module package.',
          displayName: 'Classified Info',
          icon: 'Newspaper',
          pages: [],
          slug: 'classified-info',
          tags: [],
        },
        manifestVersion: 1,
        packageVersion: '1.0.0',
        runtime: { kind: 'manifest_only', permissions: [] },
      },
    });

    expect(moduleAppPackageArchiveMetadataSchema.parse(input.archive)).toMatchObject({
      fileName: 'classified-info.zip',
      sizeBytes: 1024,
    });
    expect(input.fileManifest).toEqual([{ path: 'manifest.json', sizeBytes: 512 }]);
  });
});
