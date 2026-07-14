export const ADMIN_CAPABILITIES = {
  adminAccess: 'admin.access',
  auditRead: 'audit.read',
  contentWrite: 'content.write',
  financeRead: 'finance.read',
  financeWrite: 'finance.write',
  modelOpsWrite: 'modelOps.write',
  supportWrite: 'support.write',
  systemWrite: 'system.write',
  userWrite: 'user.write',
} as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[keyof typeof ADMIN_CAPABILITIES];

export const ADMIN_ROLE_IDS = [
  'admin',
  'content_admin',
  'finance_admin',
  'model_ops',
  'support_admin',
  'system_admin',
] as const;

export type AdminRole = (typeof ADMIN_ROLE_IDS)[number];
export type AdminRoleCapabilitySet = readonly AdminCapability[] | '*';

export const ADMIN_ROLE_CAPABILITIES: Record<AdminRole, AdminRoleCapabilitySet> = {
  admin: '*',
  content_admin: [ADMIN_CAPABILITIES.contentWrite, ADMIN_CAPABILITIES.auditRead],
  finance_admin: [
    ADMIN_CAPABILITIES.financeRead,
    ADMIN_CAPABILITIES.financeWrite,
    ADMIN_CAPABILITIES.auditRead,
  ],
  model_ops: [ADMIN_CAPABILITIES.modelOpsWrite, ADMIN_CAPABILITIES.auditRead],
  support_admin: [
    ADMIN_CAPABILITIES.supportWrite,
    ADMIN_CAPABILITIES.userWrite,
    ADMIN_CAPABILITIES.auditRead,
  ],
  system_admin: [ADMIN_CAPABILITIES.systemWrite, ADMIN_CAPABILITIES.auditRead],
};

export const isAdminRole = (role?: string | null): role is AdminRole =>
  !!role && Object.hasOwn(ADMIN_ROLE_CAPABILITIES, role);

export const getAdminRoleCapabilitySet = (role?: string | null): AdminRoleCapabilitySet => {
  if (!isAdminRole(role)) return [];

  return ADMIN_ROLE_CAPABILITIES[role];
};

export const isFullAdminRole = (role?: string | null) => getAdminRoleCapabilitySet(role) === '*';

export const getAdminRoleCapabilities = (role?: string | null): AdminCapability[] => {
  const capabilitySet = getAdminRoleCapabilitySet(role);

  if (capabilitySet === '*') return Object.values(ADMIN_CAPABILITIES);

  return [...capabilitySet];
};

export const hasAdminCapability = (
  role: string | null | undefined,
  capability: AdminCapability,
) => {
  const capabilitySet = getAdminRoleCapabilitySet(role);

  return capabilitySet === '*' || capabilitySet.includes(capability);
};
