import { moduleAppAdminUpsertSchema } from '@lobechat/types';

export const parseModuleAppAdminForm = (value: unknown) =>
  moduleAppAdminUpsertSchema.parse({
    actions: [],
    billing: {},
    pages: [{ key: 'overview', routePath: '/', title: 'Overview', type: 'overview' }],
    status: 'draft',
    tags: [],
    ...(value as Record<string, unknown>),
  });
