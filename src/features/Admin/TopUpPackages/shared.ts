export type PackageRow = {
  amount: number;
  credits: number;
  currency: string;
  displayName: string;
  id: string;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
  recommended: boolean;
  sortOrder: number;
  validityMonths: number;
};

export type PackageFormValues = {
  amount?: number;
  credits?: number;
  currency?: string;
  displayName?: string;
  id?: string;
  isActive?: boolean;
  originalAmount?: null | number;
  promotionEnabled?: boolean;
  promotionLabel?: string;
  promotionNote?: string;
  recommended?: boolean;
  sortOrder?: number;
  validityMonths?: number;
};

export const SWR_KEY = ['admin-topup-packages'];

export type AdminTopUpPackagesPageProps = {
  embedded?: boolean;
};
