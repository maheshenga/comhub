import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';

export type ModuleAppAdminSurface = 'finance' | 'governance' | 'none';

export const getModuleAppAdminSurface = (role?: string | null): ModuleAppAdminSurface => {
  if (hasAdminCapability(role, ADMIN_CAPABILITIES.moduleAppWrite)) return 'governance';
  if (hasAdminCapability(role, ADMIN_CAPABILITIES.financeRead)) return 'finance';

  return 'none';
};
