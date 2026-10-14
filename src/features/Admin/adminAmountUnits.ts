// Fiat money formatting for the Admin domain. Before this module every
// orders / payments / settlement surface rolled its own template string
// (`${currency} ${amount}`, ad-hoc `toLocaleString`, bare `CNY` fallbacks),
// so the same row could render three different shapes across pages. Keep the
// currency fallback, the thousands separators and the fraction bound here.

import { ADMIN_EMPTY_TEXT } from './shared/adminEmptyText';

/** Currency assumed when a record carries none — ComHub bills in CNY first. */
export const ADMIN_DEFAULT_CURRENCY = 'CNY';

export const formatAdminAmount = (
  value: null | number | string | undefined,
  currency?: null | string,
) => {
  if (value === null || value === undefined || value === '') return ADMIN_EMPTY_TEXT;

  const amount = Number(value);
  if (!Number.isFinite(amount)) return ADMIN_EMPTY_TEXT;

  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(amount);

  return `${currency || ADMIN_DEFAULT_CURRENCY} ${formatted}`;
};
