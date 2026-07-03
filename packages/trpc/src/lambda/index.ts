/**
 * This is your entry point to setup the root configuration for tRPC on the server.
 * - `initTRPC` should only be used once per app.
 * - We export only the functionality that we use so we can enforce which base procedures should be used
 *
 * Learn how to create protected base procedures and other things below:
 * @link https://trpc.io/docs/v11/router
 * @link https://trpc.io/docs/v11/procedures
 */

import { openTelemetry } from '../middleware/openTelemetry';
import { userAuth } from '../middleware/userAuth';
import { trpc } from './init';
import type { AdminCapability } from './middleware/adminPermissions';
import { heteroOperationAuth } from './middleware/heteroOperationAuth';
import { oidcAuth } from './middleware/oidcAuth';
import { requireAdminCapability, requireSuperAdmin } from './middleware/requireSuperAdmin';
import { serverDatabase } from './middleware/serverDatabase';

export { ADMIN_CAPABILITIES } from './middleware/adminPermissions';

/**
 * Create a router
 * @link https://trpc.io/docs/v11/router
 */
export const router = trpc.router;

/**
 * Create an unprotected procedure
 * @link https://trpc.io/docs/v11/procedures
 **/
const baseProcedure = trpc.procedure.use(openTelemetry);

export const publicProcedure = baseProcedure;

// procedure that asserts that the user is logged in
export const authedProcedure = baseProcedure.use(oidcAuth).use(userAuth);

export const adminProcedure = authedProcedure.use(serverDatabase).use(requireSuperAdmin);

export const adminCapabilityProcedure = (capability: AdminCapability) =>
  authedProcedure.use(serverDatabase).use(requireAdminCapability(capability));

// procedure for hetero-agent ingest/finish endpoints — requires a `hetero-operation` JWT
export const heteroAuthedProcedure = baseProcedure.use(heteroOperationAuth).use(userAuth);

/**
 * Create a server-side caller
 * @link https://trpc.io/docs/v11/server/server-side-calls
 */
export const createCallerFactory = trpc.createCallerFactory;
