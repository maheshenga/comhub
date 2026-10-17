import type { ReactNode } from 'react';

export interface BusinessWorkingSidebarTab {
  key: string;
  label: ReactNode;
  pane: ReactNode;
}

export interface BusinessWorkingSidebarTabsContext {
  activeAgentId?: string;
  topicId?: string;
}

export function getBusinessWorkingSidebarTabs(
  _context: BusinessWorkingSidebarTabsContext,
): BusinessWorkingSidebarTab[] {
  return [];
}
