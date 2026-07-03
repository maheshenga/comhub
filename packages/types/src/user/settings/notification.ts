export interface NotificationChannelSettings {
  enabled?: boolean;
  /** Per-type overrides grouped by category. Missing = use scenario default (true). */
  items?: Record<string, Record<string, boolean>>;
}

export interface NotificationSettings {
  email?: NotificationChannelSettings;
  inbox?: NotificationChannelSettings;
  /**
   * Mobile push notifications delivered through Expo Push Service to APNs/FCM.
   * Only takes effect for users with a registered Expo push token.
   */
  push?: NotificationChannelSettings;
}
