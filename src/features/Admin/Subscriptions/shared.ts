export type PlanFilter = 'all' | 'free' | 'hobby' | 'starter' | 'premium' | 'ultimate';

export const PLAN_COLORS: Record<string, string> = {
  free: 'default',
  hobby: 'blue',
  premium: 'gold',
  starter: 'cyan',
  ultimate: 'purple',
};

export const STATUS_COLORS: Record<string, string> = {
  active: 'success',
  canceled: 'default',
  expired: 'warning',
  past_due: 'error',
  trialing: 'processing',
};

