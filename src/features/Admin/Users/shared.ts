'use client';

import type { AdminRole } from '@lobechat/types';

export const EMPTY_TEXT = '-';

export type UserSubscription = {
  cycle: string;
  endsAt: Date | null;
  plan: string;
  startedAt: Date | null;
  status: string;
};

export type UserRow = {
  avatar: string | null;
  banned: boolean | null;
  createdAt: Date | null;
  email: string | null;
  fullName: string | null;
  id: string;
  lastActiveAt: Date | null;
  phone: string | null;
  role: string | null;
  subscription: UserSubscription | null;
};

export type AssignableRole = AdminRole | 'user' | '__none__';
