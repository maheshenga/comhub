import { asc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { adminSettingsRouter } from '@/business/server/lambda-routers/admin/settings';
import { users } from '@/database/schemas';
import { getServerDB } from '@/database/server';
import { extractClientIp } from '@/libs/trpc/utils/clientIp';

import { isCronSecretAuthorized } from '../secretAuth';

/**
 * POST /api/admin/maintenance — machine channel (cron) for the shared
 * maintenance business implementation.
 *
 * Since M4 (blueprint §6.5) this route is a thin authentication-and-forward
 * shim: after the shared bearer-secret check (`../secretAuth.ts`, constant
 * time) it invokes the single business implementation
 * `admin.settings.runMaintenance` through a server-side tRPC caller. All
 * cleanup business logic, audit envelopes, and the retention contracts live
 * in `packages/business-server/src/appSettings/writers/runtimeProcedures.ts`.
 *
 * Audit actor resolution for the cron channel: `MAINTENANCE_ACTOR_USER_ID`
 * when set, else the lowest-id full `admin` role user as a deterministic
 * stand-in (audit `actor_user_id` carries a foreign key to `users`). The
 * audit payload records `channel: 'cron'` so machine runs remain
 * distinguishable from human admin runs.
 *
 * Body (all optional, forwarded verbatim):
 *   {
 *     auditRetentionDays?: number,
 *     pendingOrderExpiryDays?: number,
 *     skipAudit?: boolean,
 *     skipModuleAppArtifacts?: boolean,
 *     skipModuleAppUploads?: boolean,
 *     skipNotifications?: boolean,
 *     skipOrders?: boolean,
 *     skipSubscriptions?: boolean,
 *   }
 */
const resolveMaintenanceActorId = async (
  db: Awaited<ReturnType<typeof getServerDB>>,
): Promise<null | string> => {
  if (process.env.MAINTENANCE_ACTOR_USER_ID) return process.env.MAINTENANCE_ACTOR_USER_ID;

  const adminUser = await db.query.users.findFirst({
    columns: { id: true },
    orderBy: [asc(users.id)],
    where: eq(users.role, 'admin'),
  });

  return adminUser?.id ?? null;
};

export const POST = async (req: NextRequest) => {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();

  const db = await getServerDB();
  const authorized = await isCronSecretAuthorized(db, token);
  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }

  const actorUserId = await resolveMaintenanceActorId(db);
  if (!actorUserId) {
    return NextResponse.json({ error: 'maintenance_actor_unavailable' }, { status: 503 });
  }

  try {
    const caller = adminSettingsRouter.createCaller({
      clientIp: extractClientIp(req.headers),
      serverDB: db,
      userId: actorUserId,
    } as any);
    const result = await caller.runMaintenance({
      ...(body as {
        auditRetentionDays?: number;
        notificationRetentionDays?: number;
        pendingOrderExpiryDays?: number;
      }),
      command: { actionId: 'setting.runMaintenance', confirmed: true },
      ...(typeof body.skipAudit === 'boolean' ? { skipAudit: body.skipAudit } : {}),
      ...(typeof body.skipModuleAppArtifacts === 'boolean'
        ? { skipModuleAppArtifacts: body.skipModuleAppArtifacts }
        : {}),
      ...(typeof body.skipModuleAppUploads === 'boolean'
        ? { skipModuleAppUploads: body.skipModuleAppUploads }
        : {}),
      ...(typeof body.skipNotifications === 'boolean'
        ? { skipNotifications: body.skipNotifications }
        : {}),
      ...(typeof body.skipOrders === 'boolean' ? { skipOrders: body.skipOrders } : {}),
      ...(typeof body.skipSubscriptions === 'boolean'
        ? { skipSubscriptions: body.skipSubscriptions }
        : {}),
    });

    return NextResponse.json({ ...result, channel: 'cron' });
  } catch (error) {
    console.error('[admin-maintenance] shared maintenance run failed', error);

    return NextResponse.json({ error: 'maintenance_failed' }, { status: 500 });
  }
};
