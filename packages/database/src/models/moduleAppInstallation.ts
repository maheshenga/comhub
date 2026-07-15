import type { ModuleAppActionConfig, ModuleAppScopeType } from '@lobechat/types';
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';

import {
  moduleAppActions,
  moduleAppBuilds,
  moduleAppEntitlements,
  moduleAppInstallations,
  moduleAppInstallationSecrets,
  moduleApps,
  moduleAppVersions,
} from '../schemas';
import { ModuleAppCatalogModel } from './moduleAppCatalog';

const INSTALL_STATUS_ACTIVE = 'installed';
const INSTALL_STATUS_INACTIVE = 'uninstalled';

type ModuleAppActionRow = typeof moduleAppActions.$inferSelect;
type ModuleAppEntitlementRow = typeof moduleAppEntitlements.$inferSelect;

const toActionConfig = (action: ModuleAppActionRow): ModuleAppActionConfig => ({
  id: action.actionKey,
  inputSchema: action.inputSchema,
  moduleMultiplier: action.moduleMultiplier,
  name: action.name,
  outputSchema: action.outputSchema,
  runtimeConfig: action.runtimeConfig,
  runtimeType: action.runtimeType,
});

export class ModuleAppInstallationModel extends ModuleAppCatalogModel {
  protected requireActiveInstallation = async (params: {
    appId: string;
    scopeType: ModuleAppScopeType;
    userId: string;
    workspaceId?: string;
  }) => {
    const installation = await this.db.query.moduleAppInstallations.findFirst({
      columns: { id: true, versionId: true },
      where: and(
        eq(moduleAppInstallations.appId, params.appId),
        eq(moduleAppInstallations.scopeType, params.scopeType),
        eq(moduleAppInstallations.status, INSTALL_STATUS_ACTIVE),
        isNull(moduleAppInstallations.uninstalledAt),
        params.scopeType === 'personal'
          ? eq(moduleAppInstallations.userId, params.userId)
          : eq(moduleAppInstallations.workspaceId, params.workspaceId ?? ''),
      ),
    });
    if (!installation) throw new Error('MODULE_APP_INSTALLATION_REQUIRED');
    return installation;
  };

  protected assertInstallationActive = async (installationId?: null | string) => {
    if (!installationId) throw new Error('MODULE_APP_INSTALLATION_REQUIRED');
    const installation = await this.db.query.moduleAppInstallations.findFirst({
      columns: { id: true },
      where: and(
        eq(moduleAppInstallations.id, installationId),
        eq(moduleAppInstallations.status, INSTALL_STATUS_ACTIVE),
        isNull(moduleAppInstallations.uninstalledAt),
      ),
    });
    if (!installation) throw new Error('MODULE_APP_INSTALLATION_REQUIRED');
    return installation;
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
    const versionId = await this.getCurrentPublishedVersionId(params.appId);

    await this.installApp({
      appId: params.appId,
      scopeType: 'personal',
      userId: params.userId,
      versionId,
    });
  };

  installWorkspaceApp = async (params: { appId: string; userId: string; workspaceId: string }) => {
    const versionId = await this.getCurrentPublishedVersionId(params.appId);

    await this.installApp({
      ...params,
      scopeType: 'workspace',
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

  uninstallWorkspaceApp = async (params: { appId: string; workspaceId: string }) => {
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
          eq(moduleAppInstallations.scopeType, 'workspace'),
          eq(moduleAppInstallations.workspaceId, params.workspaceId),
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
      ...this.toListItem(app, null, true),
      planState: this.aggregatePlanState(entitlementsByAppId.get(app.id) ?? []),
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

  getLaunchInstallationContext = async (params: {
    appId: string;
    userId: string;
    workspaceId?: string;
  }) => {
    const [row] = await this.db
      .select({
        artifactKey: moduleAppVersions.runtimeArtifactKey,
        artifactSha256: moduleAppVersions.runtimeArtifactSha256,
        billing: moduleApps.billing,
        buildArtifactKey: moduleAppBuilds.artifactKey,
        buildArtifactSha256: moduleAppBuilds.artifactSha256,
        buildStatus: moduleAppBuilds.status,
        displayName: moduleApps.displayName,
        installationId: moduleAppInstallations.id,
        publisherId: moduleApps.publisherId,
        runtimeManifest: moduleAppVersions.runtimeManifest,
        versionId: moduleAppVersions.id,
        workspaceId: moduleAppInstallations.workspaceId,
      })
      .from(moduleAppInstallations)
      .innerJoin(moduleApps, eq(moduleApps.id, moduleAppInstallations.appId))
      .innerJoin(moduleAppVersions, eq(moduleAppVersions.id, moduleAppInstallations.versionId))
      .leftJoin(moduleAppBuilds, eq(moduleAppBuilds.versionId, moduleAppVersions.id))
      .where(
        and(
          eq(moduleAppInstallations.appId, params.appId),
          eq(moduleApps.status, 'published'),
          eq(moduleAppInstallations.status, INSTALL_STATUS_ACTIVE),
          isNull(moduleAppInstallations.uninstalledAt),
          params.workspaceId
            ? and(
                eq(moduleAppInstallations.scopeType, 'workspace'),
                eq(moduleAppInstallations.workspaceId, params.workspaceId),
              )
            : and(
                eq(moduleAppInstallations.scopeType, 'personal'),
                eq(moduleAppInstallations.userId, params.userId),
              ),
        ),
      )
      .limit(1);

    if (!row) return null;

    const actions = await this.db.query.moduleAppActions.findMany({
      orderBy: [asc(moduleAppActions.createdAt)],
      where: and(
        eq(moduleAppActions.appId, params.appId),
        eq(moduleAppActions.versionId, row.versionId),
      ),
    });

    return {
      ...row,
      actions: actions.map(toActionConfig),
    };
  };

  getInstallationEntitlementSubject = async (params: { installationId: string }) => {
    const [row] = await this.db
      .select({
        appId: moduleApps.id,
        appStatus: moduleApps.status,
        scopeType: moduleAppInstallations.scopeType,
        userId: moduleAppInstallations.userId,
        workspaceId: moduleAppInstallations.workspaceId,
      })
      .from(moduleAppInstallations)
      .innerJoin(moduleApps, eq(moduleApps.id, moduleAppInstallations.appId))
      .where(eq(moduleAppInstallations.id, params.installationId))
      .limit(1);

    return row ?? null;
  };

  getRuntimeInstallationContext = async (params: {
    appId: string;
    installationId: string;
    userId: string;
    versionId: string;
    workspaceId?: string;
  }) => {
    const [row] = await this.db
      .select({
        appId: moduleApps.id,
        displayName: moduleApps.displayName,
        installationId: moduleAppInstallations.id,
        runtimeManifest: moduleAppVersions.runtimeManifest,
        scopeType: moduleAppInstallations.scopeType,
        userId: moduleAppInstallations.userId,
        versionId: moduleAppVersions.id,
        workspaceId: moduleAppInstallations.workspaceId,
      })
      .from(moduleAppInstallations)
      .innerJoin(moduleApps, eq(moduleApps.id, moduleAppInstallations.appId))
      .innerJoin(moduleAppVersions, eq(moduleAppVersions.id, moduleAppInstallations.versionId))
      .where(
        and(
          eq(moduleAppInstallations.id, params.installationId),
          eq(moduleAppInstallations.appId, params.appId),
          eq(moduleAppInstallations.versionId, params.versionId),
          eq(moduleApps.status, 'published'),
          eq(moduleAppInstallations.status, INSTALL_STATUS_ACTIVE),
          isNull(moduleAppInstallations.uninstalledAt),
          or(
            and(
              eq(moduleAppInstallations.scopeType, 'personal'),
              eq(moduleAppInstallations.userId, params.userId),
            ),
            params.workspaceId
              ? and(
                  eq(moduleAppInstallations.scopeType, 'workspace'),
                  eq(moduleAppInstallations.workspaceId, params.workspaceId),
                )
              : undefined,
          ),
        ),
      )
      .limit(1);

    return row ?? null;
  };

  getInstallationSecret = async (params: { installationId: string; key: string }) => {
    const secret = await this.db.query.moduleAppInstallationSecrets.findFirst({
      columns: { encryptedValue: true },
      where: and(
        eq(moduleAppInstallationSecrets.installationId, params.installationId),
        eq(moduleAppInstallationSecrets.secretKey, params.key),
      ),
    });

    return secret?.encryptedValue ?? null;
  };

  assertInstallationAccess = async (params: {
    installationId: string;
    userId: string;
    workspaceId?: string;
  }) => {
    const installation = await this.db.query.moduleAppInstallations.findFirst({
      columns: { id: true },
      where: and(
        eq(moduleAppInstallations.id, params.installationId),
        eq(moduleAppInstallations.status, INSTALL_STATUS_ACTIVE),
        params.workspaceId
          ? and(
              eq(moduleAppInstallations.scopeType, 'workspace'),
              eq(moduleAppInstallations.workspaceId, params.workspaceId),
            )
          : and(
              eq(moduleAppInstallations.scopeType, 'personal'),
              eq(moduleAppInstallations.userId, params.userId),
            ),
      ),
    });
    if (!installation) throw new Error('MODULE_APP_INSTALLATION_ACCESS_DENIED');
  };
}
