import { describe, expect, it } from 'vitest';

import {
  moduleAppActionConfigSchema,
  moduleAppAdminUpsertSchema,
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
});
