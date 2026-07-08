import type {
  PlatformPluginActionConfig,
  PlatformPluginAdminStats,
  PlatformPluginAdminUpsertInput,
  PlatformPluginDetail,
  PlatformPluginListItem,
  PlatformPluginMarketplaceListInput,
  PlatformPluginOperationsMetadata,
  PlatformPluginPlanEntitlement,
} from '@lobechat/types';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';

import {
  platformPluginActions,
  platformPluginAgentBindings,
  platformPluginInstallations,
  platformPluginPlanEntitlements,
  platformPlugins,
  platformPluginRuns,
  platformPluginVersions,
} from '../schemas';
import type { LobeChatDatabase, Transaction } from '../type';
import {
  readPlatformPluginOperationsMetadata,
  summarizePlatformPluginAdminStats,
  writePlatformPluginOperationsMetadata,
} from './platformPluginOperations';

const DEFAULT_VERSION = '1.0.0';
const INSTALL_STATUS_ACTIVE = 'installed';
const INSTALL_STATUS_INACTIVE = 'uninstalled';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DbExecutor = LobeChatDatabase | Transaction;
type PlatformPluginRow = typeof platformPlugins.$inferSelect;
type PlatformPluginActionRow = typeof platformPluginActions.$inferSelect;
type PlatformPluginEntitlementRow = typeof platformPluginPlanEntitlements.$inferSelect;
type PlatformPluginVersionRow = typeof platformPluginVersions.$inferSelect;

const buildPlanState = (entitlement?: PlatformPluginEntitlementRow | null) => ({
  installable: entitlement?.installable ?? false,
  runnable: entitlement?.runnable ?? false,
  visible: entitlement?.visible ?? false,
});

const aggregatePlanState = (entitlements: PlatformPluginEntitlementRow[]) =>
  entitlements.reduce(
    (state, entitlement) => ({
      installable: state.installable || entitlement.installable,
      runnable: state.runnable || entitlement.runnable,
      visible: state.visible || entitlement.visible,
    }),
    { installable: false, runnable: false, visible: false },
  );

const toListItem = (
  plugin: PlatformPluginRow,
  entitlement: PlatformPluginEntitlementRow | null | undefined,
  installed: boolean,
): PlatformPluginListItem => ({
  billing: plugin.billing,
  category: plugin.category,
  displayName: plugin.displayName,
  icon: plugin.icon,
  id: plugin.id,
  installed,
  operations: readPlatformPluginOperationsMetadata(plugin.metadata, plugin.sortOrder),
  planState: buildPlanState(entitlement),
  runtimeType: plugin.runtimeType,
  slug: plugin.slug,
  status: plugin.status,
  tags: plugin.tags,
});

const toActionConfig = (action: PlatformPluginActionRow): PlatformPluginActionConfig => {
  const base = {
    id: action.actionKey,
    inputSchema: action.inputSchema ?? { fields: [] },
    moduleMultiplier: action.moduleMultiplier,
    name: action.name,
    outputSchema: action.outputSchema ?? undefined,
    runtimeType: action.runtimeType,
  } satisfies Omit<PlatformPluginActionConfig, 'api' | 'contentGeneration'>;

  if (action.runtimeType === 'content_generation') {
    return {
      ...base,
      contentGeneration:
        action.runtimeConfig as NonNullable<PlatformPluginActionConfig['contentGeneration']>,
    };
  }

  return {
    ...base,
    api: action.runtimeConfig as NonNullable<PlatformPluginActionConfig['api']>,
  };
};

const matchesMarketplaceFilters = (
  plugin: PlatformPluginListItem,
  filters?: PlatformPluginMarketplaceListInput,
) => {
  const query = filters?.query?.toLowerCase();
  const matchesCategory = !filters?.category || plugin.category === filters.category;
  const matchesRuntime = !filters?.runtimeType || plugin.runtimeType === filters.runtimeType;
  const matchesQuery =
    !query ||
    plugin.displayName.toLowerCase().includes(query) ||
    plugin.slug.toLowerCase().includes(query) ||
    plugin.category.toLowerCase().includes(query) ||
    plugin.tags.some((tag) => tag.toLowerCase().includes(query));

  return matchesCategory && matchesRuntime && matchesQuery;
};

export class PlatformPluginModel {
  constructor(private readonly db: LobeChatDatabase) {}

  private findPluginBySlug = async (slug: string, db: DbExecutor = this.db) => {
    return db.query.platformPlugins.findFirst({
      where: eq(platformPlugins.slug, slug),
    });
  };

  private findPluginByIdOrSlug = async (pluginIdOrSlug: string, db: DbExecutor = this.db) => {
    if (UUID_PATTERN.test(pluginIdOrSlug)) {
      return db.query.platformPlugins.findFirst({
        where: eq(platformPlugins.id, pluginIdOrSlug),
      });
    }

    return db.query.platformPlugins.findFirst({
      where: eq(platformPlugins.slug, pluginIdOrSlug),
    });
  };

  private findPluginForUpsert = async (input: PlatformPluginAdminUpsertInput, db: DbExecutor = this.db) => {
    if (input.id) {
      const byId = await db.query.platformPlugins.findFirst({
        where: eq(platformPlugins.id, input.id),
      });

      if (byId) return byId;
    }

    return this.findPluginBySlug(input.slug, db);
  };

  private getLatestVersion = async (pluginId: string, db: DbExecutor = this.db) => {
    return db.query.platformPluginVersions.findFirst({
      orderBy: [desc(platformPluginVersions.createdAt)],
      where: eq(platformPluginVersions.pluginId, pluginId),
    });
  };

  private ensureVersionSnapshot = async (
    pluginId: string,
    input: PlatformPluginAdminUpsertInput,
    db: DbExecutor,
  ): Promise<PlatformPluginVersionRow> => {
    const existingVersion = await this.getLatestVersion(pluginId, db);
    const publishedAt = input.status === 'published' ? existingVersion?.publishedAt ?? new Date() : null;
    const configSnapshot = {
      actionConfig: input.actionConfig ?? null,
      billing: input.billing,
      category: input.category,
      description: input.description,
      displayName: input.displayName,
      icon: input.icon,
      runtimeType: input.runtimeType,
      slug: input.slug,
      status: input.status,
      tags: input.tags,
    } satisfies Record<string, unknown>;

    if (existingVersion) {
      const [version] = await db
        .update(platformPluginVersions)
        .set({
          changelog: '',
          configSnapshot,
          publishedAt,
          rollbackSourceVersionId: null,
          version: existingVersion.version || DEFAULT_VERSION,
        })
        .where(eq(platformPluginVersions.id, existingVersion.id))
        .returning();

      return version;
    }

    const [version] = await db
      .insert(platformPluginVersions)
      .values({
        changelog: '',
        configSnapshot,
        pluginId,
        publishedAt,
        rollbackSourceVersionId: null,
        version: DEFAULT_VERSION,
      })
      .returning();

    return version;
  };

  private ensureCurrentAction = async (
    pluginId: string,
    versionId: string,
    actionConfig: PlatformPluginAdminUpsertInput['actionConfig'],
    db: DbExecutor,
  ) => {
    await db
      .delete(platformPluginActions)
      .where(eq(platformPluginActions.pluginId, pluginId));

    if (!actionConfig) return;

    const runtimeConfig =
      actionConfig.runtimeType === 'content_generation'
        ? actionConfig.contentGeneration ?? {}
        : actionConfig.api ?? {};

    await db.insert(platformPluginActions).values({
      actionKey: actionConfig.id,
      inputSchema: actionConfig.inputSchema,
      moduleMultiplier: Math.round(actionConfig.moduleMultiplier),
      name: actionConfig.name,
      outputSchema: actionConfig.outputSchema ?? {},
      pluginId,
      runtimeConfig,
      runtimeType: actionConfig.runtimeType,
      versionId,
    });
  };

  upsertPluginForAdmin = async (
    input: PlatformPluginAdminUpsertInput,
  ): Promise<{ id: string; slug: string }> => {
    return this.db.transaction(async (tx) => {
      const existing = await this.findPluginForUpsert(input, tx);
      const operations = input.operations;
      const pluginValues = {
        billing: input.billing,
        category: input.category,
        description: input.description,
        displayName: input.displayName,
        icon: input.icon,
        metadata: writePlatformPluginOperationsMetadata(existing?.metadata, operations),
        runtimeType: input.runtimeType,
        slug: input.slug,
        sortOrder: operations.sortWeight,
        status: input.status,
        tags: input.tags,
      };

      let plugin: PlatformPluginRow;

      if (existing) {
        const updatedRows = await tx
          .update(platformPlugins)
          .set(pluginValues)
          .where(eq(platformPlugins.id, existing.id))
          .returning();
        plugin = updatedRows[0]!;
      } else {
        const insertedRows = await tx
          .insert(platformPlugins)
          .values({ ...pluginValues, id: input.id })
          .returning();
        plugin = insertedRows[0]!;
      }

      const version = await this.ensureVersionSnapshot(plugin.id, input, tx);
      await this.ensureCurrentAction(plugin.id, version.id, input.actionConfig, tx);

      return { id: plugin.id, slug: plugin.slug };
    });
  };

  setPlanEntitlements = async (
    pluginSlug: string,
    entitlements: PlatformPluginPlanEntitlement[],
  ): Promise<void> => {
    await this.db.transaction(async (tx) => {
      const plugin = await this.findPluginBySlug(pluginSlug, tx);

      if (!plugin) {
        throw new Error('PLATFORM_PLUGIN_NOT_FOUND');
      }

      await tx
        .delete(platformPluginPlanEntitlements)
        .where(eq(platformPluginPlanEntitlements.pluginId, plugin.id));

      if (entitlements.length === 0) return;

      await tx.insert(platformPluginPlanEntitlements).values(
        entitlements.map((entitlement) => ({
          discountPercent: Math.round(entitlement.discountPercent),
          forcedEnabled: false,
          freeQuotaCredits: Math.round(entitlement.freeQuotaCredits),
          installable: entitlement.installable,
          plan: entitlement.plan,
          pluginId: plugin.id,
          runnable: entitlement.runnable,
          visible: entitlement.visible,
        })),
      );
    });
  };

  updateOperationsForAdmin = async (params: {
    operations: PlatformPluginOperationsMetadata;
    pluginId: string;
  }): Promise<void> => {
    const plugin = await this.db.query.platformPlugins.findFirst({
      where: eq(platformPlugins.id, params.pluginId),
    });

    if (!plugin) throw new Error('PLATFORM_PLUGIN_NOT_FOUND');

    await this.db
      .update(platformPlugins)
      .set({
        metadata: writePlatformPluginOperationsMetadata(plugin.metadata, params.operations),
        sortOrder: params.operations.sortWeight,
        updatedAt: new Date(),
      })
      .where(eq(platformPlugins.id, params.pluginId));
  };

  getAdminStats = async (pluginIds: string[]): Promise<Map<string, PlatformPluginAdminStats>> => {
    if (pluginIds.length === 0) return new Map();

    const [plugins, installations, runs] = await Promise.all([
      this.db.query.platformPlugins.findMany({
        where: inArray(platformPlugins.id, pluginIds),
      }),
      this.db.query.platformPluginInstallations.findMany({
        where: and(
          inArray(platformPluginInstallations.pluginId, pluginIds),
          eq(platformPluginInstallations.status, INSTALL_STATUS_ACTIVE),
          isNull(platformPluginInstallations.uninstalledAt),
        ),
      }),
      this.db.query.platformPluginRuns.findMany({
        where: inArray(platformPluginRuns.pluginId, pluginIds),
      }),
    ]);

    const installationCountByPluginId = new Map<string, number>();
    for (const installation of installations) {
      installationCountByPluginId.set(
        installation.pluginId,
        (installationCountByPluginId.get(installation.pluginId) ?? 0) + 1,
      );
    }

    const runsByPluginId = new Map<
      string,
      Array<{
        billingSnapshot?: Record<string, unknown> | null;
        status: (typeof runs)[number]['status'];
      }>
    >();
    for (const run of runs) {
      const items = runsByPluginId.get(run.pluginId) ?? [];
      items.push({ billingSnapshot: run.billingSnapshot, status: run.status });
      runsByPluginId.set(run.pluginId, items);
    }

    return new Map(
      plugins.map((plugin) => [
        plugin.id,
        summarizePlatformPluginAdminStats({
          billing: plugin.billing,
          installationCount: installationCountByPluginId.get(plugin.id) ?? 0,
          runs: runsByPluginId.get(plugin.id) ?? [],
        }),
      ]),
    );
  };

  listMarketplacePlugins = async (params: {
    filters?: PlatformPluginMarketplaceListInput;
    plan: string;
    userId: string;
  }): Promise<PlatformPluginListItem[]> => {
    const rows = await this.db
      .select({
        entitlement: platformPluginPlanEntitlements,
        installationId: platformPluginInstallations.id,
        plugin: platformPlugins,
      })
      .from(platformPlugins)
      .innerJoin(
        platformPluginPlanEntitlements,
        and(
          eq(platformPluginPlanEntitlements.pluginId, platformPlugins.id),
          eq(platformPluginPlanEntitlements.plan, params.plan),
          eq(platformPluginPlanEntitlements.visible, true),
        ),
      )
      .leftJoin(
        platformPluginInstallations,
        and(
          eq(platformPluginInstallations.pluginId, platformPlugins.id),
          eq(platformPluginInstallations.userId, params.userId),
          eq(platformPluginInstallations.status, INSTALL_STATUS_ACTIVE),
          isNull(platformPluginInstallations.uninstalledAt),
        ),
      )
      .where(eq(platformPlugins.status, 'published'))
      .orderBy(asc(platformPlugins.sortOrder), asc(platformPlugins.displayName));

    return rows
      .map((row) => toListItem(row.plugin, row.entitlement, !!row.installationId))
      .filter((plugin) => matchesMarketplaceFilters(plugin, params.filters));
  };

  getPluginDetail = async (params: {
    pluginIdOrSlug: string;
    plan: string;
    userId: string;
  }): Promise<PlatformPluginDetail | null> => {
    const plugin = await this.findPluginByIdOrSlug(params.pluginIdOrSlug);

    if (!plugin || plugin.status !== 'published') return null;

    const [planEntitlement, version, entitlements, installation] = await Promise.all([
      this.db.query.platformPluginPlanEntitlements.findFirst({
        where: and(
          eq(platformPluginPlanEntitlements.pluginId, plugin.id),
          eq(platformPluginPlanEntitlements.plan, params.plan),
        ),
      }),
      this.getLatestVersion(plugin.id),
      this.db.query.platformPluginPlanEntitlements.findMany({
        orderBy: [asc(platformPluginPlanEntitlements.plan)],
        where: eq(platformPluginPlanEntitlements.pluginId, plugin.id),
      }),
      this.db.query.platformPluginInstallations.findFirst({
        where: and(
          eq(platformPluginInstallations.pluginId, plugin.id),
          eq(platformPluginInstallations.userId, params.userId),
          eq(platformPluginInstallations.status, INSTALL_STATUS_ACTIVE),
          isNull(platformPluginInstallations.uninstalledAt),
        ),
      }),
    ]);

    if (!planEntitlement?.visible || !version) return null;

    const actions = await this.db.query.platformPluginActions.findMany({
      orderBy: [asc(platformPluginActions.createdAt)],
      where: and(
        eq(platformPluginActions.pluginId, plugin.id),
        eq(platformPluginActions.versionId, version.id),
      ),
    });

    return {
      ...toListItem(plugin, planEntitlement, !!installation),
      actions: actions.map(toActionConfig),
      description: plugin.description,
      entitlements: entitlements.map((entitlement) => ({
        discountPercent: entitlement.discountPercent,
        freeQuotaCredits: entitlement.freeQuotaCredits,
        installable: entitlement.installable,
        plan: entitlement.plan,
        runnable: entitlement.runnable,
        visible: entitlement.visible,
      })),
      version: version.version,
    };
  };

  installPlugin = async (params: {
    pluginId: string;
    userId: string;
    versionId: string;
  }): Promise<void> => {
    const version = await this.db.query.platformPluginVersions.findFirst({
      where: and(
        eq(platformPluginVersions.id, params.versionId),
        eq(platformPluginVersions.pluginId, params.pluginId),
      ),
    });

    if (!version) {
      throw new Error('PLATFORM_PLUGIN_VERSION_NOT_FOUND');
    }

    const now = new Date();

    await this.db
      .insert(platformPluginInstallations)
      .values({
        installedAt: now,
        pluginId: params.pluginId,
        status: INSTALL_STATUS_ACTIVE,
        uninstalledAt: null,
        userId: params.userId,
        versionId: params.versionId,
      })
      .onConflictDoUpdate({
        set: {
          installedAt: now,
          status: INSTALL_STATUS_ACTIVE,
          uninstalledAt: null,
          updatedAt: now,
          versionId: params.versionId,
        },
        target: [platformPluginInstallations.pluginId, platformPluginInstallations.userId],
      });
  };

  uninstallPlugin = async (params: { pluginId: string; userId: string }): Promise<void> => {
    await this.db
      .update(platformPluginInstallations)
      .set({
        status: INSTALL_STATUS_INACTIVE,
        uninstalledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(platformPluginInstallations.pluginId, params.pluginId),
          eq(platformPluginInstallations.userId, params.userId),
        ),
      );
  };

  listInstalledPlugins = async (params: { userId: string }): Promise<
    Array<PlatformPluginListItem & { installationSource: 'platform_plugin_installations' }>
  > => {
    const rows = await this.db
      .select({
        plugin: platformPlugins,
      })
      .from(platformPluginInstallations)
      .innerJoin(platformPlugins, eq(platformPluginInstallations.pluginId, platformPlugins.id))
      .where(
        and(
          eq(platformPluginInstallations.userId, params.userId),
          eq(platformPluginInstallations.status, INSTALL_STATUS_ACTIVE),
          isNull(platformPluginInstallations.uninstalledAt),
        ),
      )
      .orderBy(asc(platformPlugins.sortOrder), asc(platformPlugins.displayName));

    if (rows.length === 0) return [];

    const pluginIds = rows.map((row) => row.plugin.id);
    const entitlements = await this.db.query.platformPluginPlanEntitlements.findMany({
      where: inArray(platformPluginPlanEntitlements.pluginId, pluginIds),
    });
    const entitlementsByPluginId = new Map<string, PlatformPluginEntitlementRow[]>();

    for (const entitlement of entitlements) {
      const items = entitlementsByPluginId.get(entitlement.pluginId) ?? [];
      items.push(entitlement);
      entitlementsByPluginId.set(entitlement.pluginId, items);
    }

    return rows.map(({ plugin }) => ({
      billing: plugin.billing,
      category: plugin.category,
      displayName: plugin.displayName,
      icon: plugin.icon,
      id: plugin.id,
      installationSource: 'platform_plugin_installations',
      installed: true,
      operations: readPlatformPluginOperationsMetadata(plugin.metadata, plugin.sortOrder),
      planState: aggregatePlanState(entitlementsByPluginId.get(plugin.id) ?? []),
      runtimeType: plugin.runtimeType,
      slug: plugin.slug,
      status: plugin.status,
      tags: plugin.tags,
    }));
  };

  setAgentBinding = async (params: {
    agentId: string;
    enabled: boolean;
    pluginId: string;
    userId: string;
  }): Promise<void> => {
    await this.db
      .insert(platformPluginAgentBindings)
      .values({
        agentId: params.agentId,
        enabled: params.enabled,
        pluginId: params.pluginId,
        userId: params.userId,
      })
      .onConflictDoUpdate({
        set: {
          enabled: params.enabled,
          updatedAt: new Date(),
        },
        target: [
          platformPluginAgentBindings.pluginId,
          platformPluginAgentBindings.userId,
          platformPluginAgentBindings.agentId,
        ],
      });
  };
}
