import type {
  ModuleAppActionConfig,
  ModuleAppAdminUpsertInput,
  ModuleAppMarketplaceListInput,
  ModuleAppPage,
  ModuleAppPlanEntitlement,
  ModuleAppRecordInput,
  ModuleAppRunInput,
  ModuleAppRunStatus,
  ModuleAppScopeType,
  ModuleAppStatus,
} from '@lobechat/types';
import { and, asc, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';

import {
  moduleAppActions,
  moduleAppArtifacts,
  moduleAppAuditLogs,
  moduleAppEntitlements,
  moduleAppInstallations,
  moduleAppPages,
  moduleAppRecordEvents,
  moduleAppRecords,
  moduleAppRuns,
  moduleApps,
  moduleAppVersions,
} from '../schemas';
import type { LobeChatDatabase, Transaction } from '../type';

const DEFAULT_VERSION = '1.0.0';
const INSTALL_STATUS_ACTIVE = 'installed';
const INSTALL_STATUS_INACTIVE = 'uninstalled';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DbExecutor = LobeChatDatabase | Transaction;
type ModuleAppRow = typeof moduleApps.$inferSelect;
type ModuleAppActionRow = typeof moduleAppActions.$inferSelect;
type ModuleAppEntitlementRow = typeof moduleAppEntitlements.$inferSelect;
type ModuleAppPageRow = typeof moduleAppPages.$inferSelect;
type ModuleAppVersionRow = typeof moduleAppVersions.$inferSelect;

const buildPlanState = (entitlement?: ModuleAppEntitlementRow | null) => ({
  installable: entitlement?.installable ?? false,
  runnable: entitlement?.runnable ?? false,
  visible: entitlement?.visible ?? false,
});

const aggregatePlanState = (entitlements: ModuleAppEntitlementRow[]) =>
  entitlements.reduce(
    (state, entitlement) => ({
      installable: state.installable || entitlement.installable,
      runnable: state.runnable || entitlement.runnable,
      visible: state.visible || entitlement.visible,
    }),
    { installable: false, runnable: false, visible: false },
  );

const toListItem = (
  app: ModuleAppRow,
  entitlement: ModuleAppEntitlementRow | null | undefined,
  installed: boolean,
) => ({
  appType: app.appType,
  billing: app.billing,
  category: app.category,
  displayName: app.displayName,
  icon: app.icon,
  id: app.id,
  installed,
  planState: buildPlanState(entitlement),
  slug: app.slug,
  status: app.status,
  tags: app.tags,
});

const toPageConfig = (page: ModuleAppPageRow): ModuleAppPage => ({
  actionBindings: page.actionBindings,
  dataSource: page.dataSource,
  key: page.pageKey,
  layoutSchema: page.layoutSchema,
  routePath: page.routePath,
  sortOrder: page.sortOrder,
  title: page.title,
  type: page.pageType as ModuleAppPage['type'],
});

const toActionConfig = (action: ModuleAppActionRow): ModuleAppActionConfig => ({
  id: action.actionKey,
  inputSchema: action.inputSchema,
  moduleMultiplier: action.moduleMultiplier,
  name: action.name,
  outputSchema: action.outputSchema,
  runtimeConfig: action.runtimeConfig,
  runtimeType: action.runtimeType,
});

const toEntitlementConfig = (
  entitlement: ModuleAppEntitlementRow,
): ModuleAppPlanEntitlement => ({
  discountPercent: entitlement.discountPercent,
  freeQuotaCredits: entitlement.freeQuotaCredits,
  installable: entitlement.installable,
  plan: entitlement.plan,
  runnable: entitlement.runnable,
  visible: entitlement.visible,
});

const matchesMarketplaceFilters = (
  app: ReturnType<typeof toListItem>,
  filters?: ModuleAppMarketplaceListInput,
) => {
  const query = filters?.query?.toLowerCase();
  const matchesCategory = !filters?.category || app.category === filters.category;
  const matchesType = !filters?.appType || app.appType === filters.appType;
  const matchesQuery =
    !query ||
    app.displayName.toLowerCase().includes(query) ||
    app.slug.toLowerCase().includes(query) ||
    app.category.toLowerCase().includes(query) ||
    app.tags.some((tag) => tag.toLowerCase().includes(query));

  return matchesCategory && matchesType && matchesQuery;
};

const recordScopeWhere = (params: {
  scopeType: ModuleAppScopeType;
  userId: string;
  workspaceId?: string;
}) =>
  params.scopeType === 'personal'
    ? and(
        eq(moduleAppRecords.scopeType, 'personal'),
        eq(moduleAppRecords.ownerUserId, params.userId),
        isNull(moduleAppRecords.workspaceId),
      )
    : and(
        eq(moduleAppRecords.scopeType, 'workspace'),
        eq(moduleAppRecords.workspaceId, params.workspaceId ?? ''),
      );

const runScopeWhere = (params: {
  scopeType?: ModuleAppScopeType;
  userId: string;
  workspaceId?: string;
}) =>
  params.scopeType === 'workspace' || params.workspaceId
    ? and(
        eq(moduleAppRuns.scopeType, 'workspace'),
        eq(moduleAppRuns.workspaceId, params.workspaceId ?? ''),
      )
    : and(eq(moduleAppRuns.scopeType, 'personal'), eq(moduleAppRuns.userId, params.userId));

const artifactScopeWhere = (params: {
  scopeType?: ModuleAppScopeType;
  userId: string;
  workspaceId?: string;
}) =>
  params.scopeType === 'workspace' || params.workspaceId
    ? and(
        eq(moduleAppArtifacts.scopeType, 'workspace'),
        eq(moduleAppArtifacts.workspaceId, params.workspaceId ?? ''),
      )
    : and(
        eq(moduleAppArtifacts.scopeType, 'personal'),
        eq(moduleAppArtifacts.userId, params.userId),
      );

export class ModuleAppModel {
  constructor(private readonly db: LobeChatDatabase) {}

  private findAppBySlug = async (slug: string, db: DbExecutor = this.db) => {
    return db.query.moduleApps.findFirst({
      where: eq(moduleApps.slug, slug),
    });
  };

  private findAppByIdOrSlug = async (appIdOrSlug: string, db: DbExecutor = this.db) => {
    if (UUID_PATTERN.test(appIdOrSlug)) {
      return db.query.moduleApps.findFirst({
        where: eq(moduleApps.id, appIdOrSlug),
      });
    }

    return this.findAppBySlug(appIdOrSlug, db);
  };

  private findAppForUpsert = async (
    input: ModuleAppAdminUpsertInput,
    db: DbExecutor = this.db,
  ) => {
    if (input.id) {
      const byId = await db.query.moduleApps.findFirst({
        where: eq(moduleApps.id, input.id),
      });

      if (byId) return byId;
    }

    return this.findAppBySlug(input.slug, db);
  };

  private getLatestVersion = async (appId: string, db: DbExecutor = this.db) => {
    return db.query.moduleAppVersions.findFirst({
      orderBy: [desc(moduleAppVersions.createdAt)],
      where: eq(moduleAppVersions.appId, appId),
    });
  };

  private getLatestVersionId = async (appId: string) => {
    const version = await this.getLatestVersion(appId);

    if (!version) throw new Error('MODULE_APP_VERSION_NOT_FOUND');

    return version.id;
  };

  private ensureVersionSnapshot = async (
    appId: string,
    input: ModuleAppAdminUpsertInput,
    db: DbExecutor,
  ): Promise<ModuleAppVersionRow> => {
    const existingVersion = await this.getLatestVersion(appId, db);
    const publishedAt = input.status === 'published' ? existingVersion?.publishedAt ?? new Date() : null;
    const manifestSnapshot = {
      actions: input.actions,
      appType: input.appType,
      billing: input.billing,
      category: input.category,
      description: input.description,
      displayName: input.displayName,
      icon: input.icon,
      pages: input.pages,
      slug: input.slug,
      status: input.status,
      tags: input.tags,
    } satisfies Record<string, unknown>;

    if (existingVersion) {
      const [version] = await db
        .update(moduleAppVersions)
        .set({
          changelog: '',
          manifestSnapshot,
          publishedAt,
          rollbackSourceVersionId: null,
          version: existingVersion.version || DEFAULT_VERSION,
        })
        .where(eq(moduleAppVersions.id, existingVersion.id))
        .returning();

      return version;
    }

    const [version] = await db
      .insert(moduleAppVersions)
      .values({
        appId,
        changelog: '',
        manifestSnapshot,
        publishedAt,
        rollbackSourceVersionId: null,
        version: DEFAULT_VERSION,
      })
      .returning();

    return version;
  };

  private replacePagesAndActions = async (
    appId: string,
    versionId: string,
    input: ModuleAppAdminUpsertInput,
    db: DbExecutor,
  ) => {
    await db.delete(moduleAppPages).where(eq(moduleAppPages.appId, appId));
    await db.delete(moduleAppActions).where(eq(moduleAppActions.appId, appId));

    if (input.pages.length > 0) {
      await db.insert(moduleAppPages).values(
        input.pages.map((page) => ({
          actionBindings: page.actionBindings,
          appId,
          dataSource: page.dataSource,
          layoutSchema: page.layoutSchema,
          pageKey: page.key,
          pageType: page.type,
          routePath: page.routePath,
          sortOrder: page.sortOrder,
          title: page.title,
          versionId,
        })),
      );
    }

    if (input.actions.length > 0) {
      await db.insert(moduleAppActions).values(
        input.actions.map((action) => ({
          actionKey: action.id,
          appId,
          inputSchema: action.inputSchema,
          moduleMultiplier: Math.round(action.moduleMultiplier),
          name: action.name,
          outputSchema: action.outputSchema,
          runtimeConfig: action.runtimeConfig,
          runtimeType: action.runtimeType,
          versionId,
        })),
      );
    }
  };

  upsertAppForAdmin = async (
    input: ModuleAppAdminUpsertInput,
  ): Promise<{ id: string; slug: string }> => {
    return this.db.transaction(async (tx) => {
      const existing = await this.findAppForUpsert(input, tx);
      const appValues = {
        appType: input.appType,
        billing: input.billing,
        category: input.category,
        description: input.description,
        displayName: input.displayName,
        icon: input.icon,
        metadata: {},
        slug: input.slug,
        status: input.status,
        tags: input.tags,
      };

      let app: ModuleAppRow;

      if (existing) {
        const [updated] = await tx
          .update(moduleApps)
          .set({ ...appValues, updatedAt: new Date() })
          .where(eq(moduleApps.id, existing.id))
          .returning();
        app = updated;
      } else {
        const [inserted] = await tx
          .insert(moduleApps)
          .values({ ...appValues, id: input.id })
          .returning();
        app = inserted;
      }

      const version = await this.ensureVersionSnapshot(app.id, input, tx);
      await this.replacePagesAndActions(app.id, version.id, input, tx);

      return { id: app.id, slug: app.slug };
    });
  };

  listAdminApps = async (
    params: {
      category?: string;
      cursor?: number;
      limit?: number;
      status?: ModuleAppStatus;
    } = {},
  ) => {
    const limit = params.limit ?? 50;
    const cursor = params.cursor ?? 0;
    const where =
      params.status && params.category
        ? and(eq(moduleApps.status, params.status), eq(moduleApps.category, params.category))
        : params.status
          ? eq(moduleApps.status, params.status)
          : params.category
            ? eq(moduleApps.category, params.category)
            : undefined;

    const items = await this.db.query.moduleApps.findMany({
      limit,
      offset: cursor,
      orderBy: [asc(moduleApps.sortOrder), asc(moduleApps.displayName)],
      where,
    });

    return {
      items,
      nextCursor: items.length === limit ? cursor + limit : null,
    };
  };

  getAdminApp = async (params: { appId: string }) => {
    const app = await this.db.query.moduleApps.findFirst({
      where: eq(moduleApps.id, params.appId),
    });

    if (!app) return null;

    const [version, pages, actions, entitlements] = await Promise.all([
      this.getLatestVersion(app.id),
      this.db.query.moduleAppPages.findMany({
        orderBy: [asc(moduleAppPages.sortOrder), asc(moduleAppPages.createdAt)],
        where: eq(moduleAppPages.appId, app.id),
      }),
      this.db.query.moduleAppActions.findMany({
        orderBy: [asc(moduleAppActions.createdAt)],
        where: eq(moduleAppActions.appId, app.id),
      }),
      this.db.query.moduleAppEntitlements.findMany({
        orderBy: [asc(moduleAppEntitlements.plan)],
        where: eq(moduleAppEntitlements.appId, app.id),
      }),
    ]);

    return {
      ...app,
      actions: actions.map(toActionConfig),
      entitlements: entitlements.map(toEntitlementConfig),
      pages: pages.map(toPageConfig),
      version: version?.version ?? DEFAULT_VERSION,
    };
  };

  setStatus = async (params: { appId: string; status: ModuleAppStatus }) => {
    await this.db
      .update(moduleApps)
      .set({ status: params.status, updatedAt: new Date() })
      .where(eq(moduleApps.id, params.appId));

    const version = await this.getLatestVersion(params.appId);

    if (version) {
      await this.db
        .update(moduleAppVersions)
        .set({
          publishedAt:
            params.status === 'published' ? version.publishedAt ?? new Date() : null,
        })
        .where(eq(moduleAppVersions.id, version.id));
    }

    return { ok: true as const };
  };

  upsertPagesForAdmin = async (params: { appId: string; pages: ModuleAppPage[] }) => {
    const versionId = await this.getLatestVersionId(params.appId);

    await this.db.delete(moduleAppPages).where(eq(moduleAppPages.appId, params.appId));

    if (params.pages.length > 0) {
      await this.db.insert(moduleAppPages).values(
        params.pages.map((page) => ({
          actionBindings: page.actionBindings,
          appId: params.appId,
          dataSource: page.dataSource,
          layoutSchema: page.layoutSchema,
          pageKey: page.key,
          pageType: page.type,
          routePath: page.routePath,
          sortOrder: page.sortOrder,
          title: page.title,
          versionId,
        })),
      );
    }

    return { ok: true as const };
  };

  upsertActionsForAdmin = async (params: {
    actions: ModuleAppActionConfig[];
    appId: string;
  }) => {
    const versionId = await this.getLatestVersionId(params.appId);

    await this.db.delete(moduleAppActions).where(eq(moduleAppActions.appId, params.appId));

    if (params.actions.length > 0) {
      await this.db.insert(moduleAppActions).values(
        params.actions.map((action) => ({
          actionKey: action.id,
          appId: params.appId,
          inputSchema: action.inputSchema,
          moduleMultiplier: Math.round(action.moduleMultiplier),
          name: action.name,
          outputSchema: action.outputSchema,
          runtimeConfig: action.runtimeConfig,
          runtimeType: action.runtimeType,
          versionId,
        })),
      );
    }

    return { ok: true as const };
  };

  upsertBillingForAdmin = async (params: {
    appId: string;
    billing: ModuleAppAdminUpsertInput['billing'];
  }) => {
    await this.db
      .update(moduleApps)
      .set({ billing: params.billing, updatedAt: new Date() })
      .where(eq(moduleApps.id, params.appId));

    return { ok: true as const };
  };

  upsertEntitlementsForAdmin = async (params: {
    appId: string;
    entitlements: ModuleAppPlanEntitlement[];
  }) => {
    await this.db
      .delete(moduleAppEntitlements)
      .where(eq(moduleAppEntitlements.appId, params.appId));

    if (params.entitlements.length > 0) {
      await this.db.insert(moduleAppEntitlements).values(
        params.entitlements.map((entitlement) => ({
          appId: params.appId,
          discountPercent: entitlement.discountPercent,
          freeQuotaCredits: entitlement.freeQuotaCredits,
          installable: entitlement.installable,
          plan: entitlement.plan,
          runnable: entitlement.runnable,
          visible: entitlement.visible,
        })),
      );
    }

    return { ok: true as const };
  };

  listAdminInstalls = async (params: { appId: string; cursor?: number; limit?: number }) => {
    const limit = params.limit ?? 50;
    const cursor = params.cursor ?? 0;
    const items = await this.db.query.moduleAppInstallations.findMany({
      limit,
      offset: cursor,
      orderBy: [desc(moduleAppInstallations.createdAt)],
      where: eq(moduleAppInstallations.appId, params.appId),
    });

    return { items, nextCursor: items.length === limit ? cursor + limit : null };
  };

  listAdminRecords = async (params: { appId: string; cursor?: number; limit?: number }) => {
    const limit = params.limit ?? 50;
    const cursor = params.cursor ?? 0;
    const items = await this.db.query.moduleAppRecords.findMany({
      limit,
      offset: cursor,
      orderBy: [desc(moduleAppRecords.updatedAt)],
      where: eq(moduleAppRecords.appId, params.appId),
    });

    return { items, nextCursor: items.length === limit ? cursor + limit : null };
  };

  listAdminRuns = async (params: { appId: string; cursor?: number; limit?: number }) => {
    const limit = params.limit ?? 50;
    const cursor = params.cursor ?? 0;
    const items = await this.db.query.moduleAppRuns.findMany({
      limit,
      offset: cursor,
      orderBy: [desc(moduleAppRuns.createdAt)],
      where: eq(moduleAppRuns.appId, params.appId),
    });

    return { items, nextCursor: items.length === limit ? cursor + limit : null };
  };

  listAdminArtifacts = async (params: { appId: string; cursor?: number; limit?: number }) => {
    const limit = params.limit ?? 50;
    const cursor = params.cursor ?? 0;
    const items = await this.db.query.moduleAppArtifacts.findMany({
      limit,
      offset: cursor,
      orderBy: [desc(moduleAppArtifacts.createdAt)],
      where: eq(moduleAppArtifacts.appId, params.appId),
    });

    return { items, nextCursor: items.length === limit ? cursor + limit : null };
  };

  listAdminAuditEvents = async (params: { appId: string; cursor?: number; limit?: number }) => {
    const limit = params.limit ?? 50;
    const cursor = params.cursor ?? 0;
    const items = await this.db.query.moduleAppAuditLogs.findMany({
      limit,
      offset: cursor,
      orderBy: [desc(moduleAppAuditLogs.createdAt)],
      where: and(
        eq(moduleAppAuditLogs.resourceType, 'moduleApp'),
        eq(moduleAppAuditLogs.resourceId, params.appId),
      ),
    });

    return { items, nextCursor: items.length === limit ? cursor + limit : null };
  };

  listMarketplaceApps = async (params: {
    filters?: ModuleAppMarketplaceListInput;
    plan: string;
    userId: string;
  }) => {
    const rows = await this.db
      .select({
        app: moduleApps,
        entitlement: moduleAppEntitlements,
        installationId: moduleAppInstallations.id,
      })
      .from(moduleApps)
      .innerJoin(
        moduleAppEntitlements,
        and(
          eq(moduleAppEntitlements.appId, moduleApps.id),
          eq(moduleAppEntitlements.plan, params.plan),
          eq(moduleAppEntitlements.visible, true),
        ),
      )
      .leftJoin(
        moduleAppInstallations,
        and(
          eq(moduleAppInstallations.appId, moduleApps.id),
          eq(moduleAppInstallations.scopeType, 'personal'),
          eq(moduleAppInstallations.userId, params.userId),
          eq(moduleAppInstallations.status, INSTALL_STATUS_ACTIVE),
          isNull(moduleAppInstallations.uninstalledAt),
        ),
      )
      .where(eq(moduleApps.status, 'published'))
      .orderBy(asc(moduleApps.sortOrder), asc(moduleApps.displayName));

    return rows
      .map((row) => toListItem(row.app, row.entitlement, !!row.installationId))
      .filter((app) => matchesMarketplaceFilters(app, params.filters));
  };

  getAppDetail = async (params: {
    appIdOrSlug: string;
    plan: string;
    userId: string;
  }) => {
    const app = await this.findAppByIdOrSlug(params.appIdOrSlug);

    if (!app || app.status !== 'published') return null;

    const [planEntitlement, version, entitlements, installation] = await Promise.all([
      this.db.query.moduleAppEntitlements.findFirst({
        where: and(
          eq(moduleAppEntitlements.appId, app.id),
          eq(moduleAppEntitlements.plan, params.plan),
        ),
      }),
      this.getLatestVersion(app.id),
      this.db.query.moduleAppEntitlements.findMany({
        orderBy: [asc(moduleAppEntitlements.plan)],
        where: eq(moduleAppEntitlements.appId, app.id),
      }),
      this.db.query.moduleAppInstallations.findFirst({
        where: and(
          eq(moduleAppInstallations.appId, app.id),
          eq(moduleAppInstallations.scopeType, 'personal'),
          eq(moduleAppInstallations.userId, params.userId),
          eq(moduleAppInstallations.status, INSTALL_STATUS_ACTIVE),
          isNull(moduleAppInstallations.uninstalledAt),
        ),
      }),
    ]);

    if (!planEntitlement?.visible || !version) return null;

    const [pages, actions] = await Promise.all([
      this.db.query.moduleAppPages.findMany({
        orderBy: [asc(moduleAppPages.sortOrder), asc(moduleAppPages.createdAt)],
        where: and(
          eq(moduleAppPages.appId, app.id),
          eq(moduleAppPages.versionId, version.id),
        ),
      }),
      this.db.query.moduleAppActions.findMany({
        orderBy: [asc(moduleAppActions.createdAt)],
        where: and(
          eq(moduleAppActions.appId, app.id),
          eq(moduleAppActions.versionId, version.id),
        ),
      }),
    ]);

    return {
      ...toListItem(app, planEntitlement, !!installation),
      actions: actions.map(toActionConfig),
      description: app.description,
      entitlements: entitlements.map(toEntitlementConfig),
      pages: pages.map(toPageConfig),
      version: version.version,
    };
  };

  installApp = async (params: {
    appId: string;
    scopeType: ModuleAppScopeType;
    userId: string;
    versionId: string;
    workspaceId?: string;
  }) => {
    const version = await this.db.query.moduleAppVersions.findFirst({
      where: and(
        eq(moduleAppVersions.id, params.versionId),
        eq(moduleAppVersions.appId, params.appId),
      ),
    });

    if (!version) throw new Error('MODULE_APP_VERSION_NOT_FOUND');

    const now = new Date();
    const existing = await this.db.query.moduleAppInstallations.findFirst({
      where:
        params.scopeType === 'personal'
          ? and(
              eq(moduleAppInstallations.appId, params.appId),
              eq(moduleAppInstallations.scopeType, 'personal'),
              eq(moduleAppInstallations.userId, params.userId),
            )
          : and(
              eq(moduleAppInstallations.appId, params.appId),
              eq(moduleAppInstallations.scopeType, 'workspace'),
              eq(moduleAppInstallations.workspaceId, params.workspaceId ?? ''),
            ),
    });

    if (existing) {
      await this.db
        .update(moduleAppInstallations)
        .set({
          installedAt: now,
          status: INSTALL_STATUS_ACTIVE,
          uninstalledAt: null,
          updatedAt: now,
          versionId: params.versionId,
        })
        .where(eq(moduleAppInstallations.id, existing.id));
      return;
    }

    await this.db.insert(moduleAppInstallations).values({
      appId: params.appId,
      installedAt: now,
      scopeType: params.scopeType,
      status: INSTALL_STATUS_ACTIVE,
      uninstalledAt: null,
      userId: params.scopeType === 'personal' ? params.userId : params.userId,
      versionId: params.versionId,
      workspaceId: params.scopeType === 'workspace' ? params.workspaceId : undefined,
    });
  };

  installPersonalApp = async (params: { appId: string; userId: string }) => {
    const versionId = await this.getLatestVersionId(params.appId);

    await this.installApp({
      appId: params.appId,
      scopeType: 'personal',
      userId: params.userId,
      versionId,
    });
  };

  uninstallPersonalApp = async (params: { appId: string; userId: string }) => {
    await this.db
      .update(moduleAppInstallations)
      .set({
        status: INSTALL_STATUS_INACTIVE,
        uninstalledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(moduleAppInstallations.appId, params.appId),
          eq(moduleAppInstallations.scopeType, 'personal'),
          eq(moduleAppInstallations.userId, params.userId),
        ),
      );

    return { ok: true as const };
  };

  listInstalledApps = async (params: {
    scopeType: ModuleAppScopeType;
    userId: string;
    workspaceId?: string;
  }) => {
    const rows = await this.db
      .select({ app: moduleApps })
      .from(moduleAppInstallations)
      .innerJoin(moduleApps, eq(moduleAppInstallations.appId, moduleApps.id))
      .where(
        params.scopeType === 'personal'
          ? and(
              eq(moduleAppInstallations.scopeType, 'personal'),
              eq(moduleAppInstallations.userId, params.userId),
              eq(moduleAppInstallations.status, INSTALL_STATUS_ACTIVE),
              isNull(moduleAppInstallations.uninstalledAt),
            )
          : and(
              eq(moduleAppInstallations.scopeType, 'workspace'),
              eq(moduleAppInstallations.workspaceId, params.workspaceId ?? ''),
              eq(moduleAppInstallations.status, INSTALL_STATUS_ACTIVE),
              isNull(moduleAppInstallations.uninstalledAt),
            ),
      )
      .orderBy(asc(moduleApps.sortOrder), asc(moduleApps.displayName));

    if (rows.length === 0) return [];

    const appIds = rows.map((row) => row.app.id);
    const entitlements = await this.db.query.moduleAppEntitlements.findMany({
      where: inArray(moduleAppEntitlements.appId, appIds),
    });
    const entitlementsByAppId = new Map<string, ModuleAppEntitlementRow[]>();

    for (const entitlement of entitlements) {
      const items = entitlementsByAppId.get(entitlement.appId) ?? [];
      items.push(entitlement);
      entitlementsByAppId.set(entitlement.appId, items);
    }

    return rows.map(({ app }) => ({
      ...toListItem(app, null, true),
      planState: aggregatePlanState(entitlementsByAppId.get(app.id) ?? []),
    }));
  };

  getRuntimeManifest = async (params: { appId: string; plan: string; userId: string }) => {
    const detail = await this.getAppDetail({
      appIdOrSlug: params.appId,
      plan: params.plan,
      userId: params.userId,
    });

    if (!detail) return null;

    return {
      actions: detail.actions,
      appId: detail.id,
      appType: detail.appType,
      billing: detail.billing,
      displayName: detail.displayName,
      pages: detail.pages,
      slug: detail.slug,
      version: detail.version,
    };
  };

  listRecords = async (params: {
    appId: string;
    collectionKey: string;
    scopeType: ModuleAppScopeType;
    userId: string;
    workspaceId?: string;
  }) => {
    return this.db.query.moduleAppRecords.findMany({
      orderBy: [desc(moduleAppRecords.updatedAt)],
      where: and(
        eq(moduleAppRecords.appId, params.appId),
        eq(moduleAppRecords.collectionKey, params.collectionKey),
        ne(moduleAppRecords.status, 'archived'),
        recordScopeWhere(params),
      ),
    });
  };

  getRecord = async (params: {
    appId: string;
    recordId: string;
    userId: string;
    workspaceId?: string;
  }) => {
    const personalAccess = and(
      eq(moduleAppRecords.scopeType, 'personal'),
      eq(moduleAppRecords.ownerUserId, params.userId),
      isNull(moduleAppRecords.workspaceId),
    );
    const scopedAccess = params.workspaceId
      ? or(
          personalAccess,
          and(
            eq(moduleAppRecords.scopeType, 'workspace'),
            eq(moduleAppRecords.workspaceId, params.workspaceId),
          ),
        )
      : personalAccess;

    return (
      (await this.db.query.moduleAppRecords.findFirst({
        where: and(
          eq(moduleAppRecords.id, params.recordId),
          eq(moduleAppRecords.appId, params.appId),
          ne(moduleAppRecords.status, 'archived'),
          scopedAccess,
        ),
      })) ?? null
    );
  };

  createRecord = async (params: ModuleAppRecordInput & { recordKey?: string; userId: string }) => {
    const [record] = await this.db
      .insert(moduleAppRecords)
      .values({
        appId: params.appId,
        collectionKey: params.collectionKey,
        createdBy: params.userId,
        data: params.data,
        ownerUserId: params.scopeType === 'personal' ? params.userId : undefined,
        recordKey: params.recordKey,
        scopeType: params.scopeType,
        title: params.title,
        updatedBy: params.userId,
        workspaceId: params.scopeType === 'workspace' ? params.workspaceId : undefined,
      })
      .returning();

    await this.db.insert(moduleAppRecordEvents).values({
      actorUserId: params.userId,
      afterSnapshot: record,
      appId: params.appId,
      beforeSnapshot: {},
      eventType: 'created',
      metadata: {},
      recordId: record.id,
      scopeType: params.scopeType,
      workspaceId: params.scopeType === 'workspace' ? params.workspaceId : undefined,
    });

    return record;
  };

  updateRecord = async (params: ModuleAppRecordInput & { userId: string }) => {
    if (!params.recordId) throw new Error('MODULE_APP_RECORD_ID_REQUIRED');

    const existing = await this.db.query.moduleAppRecords.findFirst({
      where: and(
        eq(moduleAppRecords.id, params.recordId),
        eq(moduleAppRecords.appId, params.appId),
        recordScopeWhere(params),
      ),
    });

    if (!existing) throw new Error('MODULE_APP_RECORD_NOT_FOUND');

    const [record] = await this.db
      .update(moduleAppRecords)
      .set({
        data: params.data,
        title: params.title,
        updatedAt: new Date(),
        updatedBy: params.userId,
      })
      .where(eq(moduleAppRecords.id, params.recordId))
      .returning();

    await this.db.insert(moduleAppRecordEvents).values({
      actorUserId: params.userId,
      afterSnapshot: record,
      appId: params.appId,
      beforeSnapshot: existing,
      eventType: 'updated',
      metadata: {},
      recordId: record.id,
      scopeType: record.scopeType,
      workspaceId: record.workspaceId,
    });

    return record;
  };

  archiveRecord = async (params: { appId: string; recordId: string; userId: string }) => {
    const existing = await this.db.query.moduleAppRecords.findFirst({
      where: and(
        eq(moduleAppRecords.id, params.recordId),
        eq(moduleAppRecords.appId, params.appId),
      ),
    });

    if (!existing) throw new Error('MODULE_APP_RECORD_NOT_FOUND');

    const [record] = await this.db
      .update(moduleAppRecords)
      .set({
        status: 'archived',
        updatedAt: new Date(),
        updatedBy: params.userId,
      })
      .where(eq(moduleAppRecords.id, params.recordId))
      .returning();

    await this.db.insert(moduleAppRecordEvents).values({
      actorUserId: params.userId,
      afterSnapshot: record,
      appId: params.appId,
      beforeSnapshot: existing,
      eventType: 'archived',
      metadata: {},
      recordId: record.id,
      scopeType: record.scopeType,
      workspaceId: record.workspaceId,
    });

    return { ok: true as const };
  };

  createRun = async (params: ModuleAppRunInput & { userId: string }) => {
    const action = await this.db.query.moduleAppActions.findFirst({
      where: and(
        eq(moduleAppActions.appId, params.appId),
        eq(moduleAppActions.actionKey, params.actionId),
      ),
    });

    const [run] = await this.db
      .insert(moduleAppRuns)
      .values({
        actionId: action?.id,
        appId: params.appId,
        inputSnapshot: params.input,
        recordId: params.recordId,
        scopeType: params.scopeType,
        status: 'running',
        userId: params.userId,
        versionId: action?.versionId,
        workspaceId: params.scopeType === 'workspace' ? params.workspaceId : undefined,
      })
      .returning();

    return run;
  };

  updateRun = async (params: {
    billing?: Record<string, unknown>;
    durationMs?: number;
    errorMessage?: string;
    errorType?: string;
    output?: Record<string, unknown>;
    runId: string;
    status: ModuleAppRunStatus;
  }) => {
    await this.db
      .update(moduleAppRuns)
      .set({
        billingSnapshot: params.billing,
        durationMs: params.durationMs,
        errorMessage: params.errorMessage,
        errorType: params.errorType,
        outputSnapshot: params.output,
        status: params.status,
        updatedAt: new Date(),
      })
      .where(eq(moduleAppRuns.id, params.runId));

    return { ok: true as const };
  };

  listRuns = async (params: {
    appId: string;
    cursor?: number;
    limit?: number;
    scopeType?: ModuleAppScopeType;
    userId: string;
    workspaceId?: string;
  }) => {
    const limit = params.limit ?? 50;
    const cursor = params.cursor ?? 0;
    const items = await this.db.query.moduleAppRuns.findMany({
      limit,
      offset: cursor,
      orderBy: [desc(moduleAppRuns.createdAt)],
      where: and(eq(moduleAppRuns.appId, params.appId), runScopeWhere(params)),
    });

    return {
      items,
      nextCursor: items.length === limit ? cursor + limit : null,
    };
  };

  listArtifacts = async (params: {
    appId: string;
    cursor?: number;
    limit?: number;
    scopeType?: ModuleAppScopeType;
    userId: string;
    workspaceId?: string;
  }) => {
    const limit = params.limit ?? 50;
    const cursor = params.cursor ?? 0;
    const items = await this.db.query.moduleAppArtifacts.findMany({
      limit,
      offset: cursor,
      orderBy: [desc(moduleAppArtifacts.createdAt)],
      where: and(eq(moduleAppArtifacts.appId, params.appId), artifactScopeWhere(params)),
    });

    return {
      items,
      nextCursor: items.length === limit ? cursor + limit : null,
    };
  };
}
