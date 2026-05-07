export const PRICING_SETTING_KEYS = {
  ordersEnabled: 'orders.management.enabled',
  pricingMultiplier: 'pricing.creditMultiplier',
} as const;

export type AdminPricingSettingsFormValues = {
  ordersEnabled: boolean;
  pricingMultiplier: number;
};

export const buildPricingSettingUpdates = (values: AdminPricingSettingsFormValues) => [
  {
    key: PRICING_SETTING_KEYS.pricingMultiplier,
    value: values.pricingMultiplier,
  },
  {
    key: PRICING_SETTING_KEYS.ordersEnabled,
    value: Boolean(values.ordersEnabled),
  },
];
