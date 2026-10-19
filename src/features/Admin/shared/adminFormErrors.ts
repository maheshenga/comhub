/**
 * Form validation errors are not save failures.
 *
 * antd/rc-field-form rejects `validateFields()` with an object carrying
 * `errorFields` when any rule fails. Pages that wrap `validateFields()` and the
 * submit call in one `try` therefore land in their `catch` on a plain field
 * validation problem, and toasts a generic "save failed" — telling the
 * administrator the write was attempted and rejected when nothing was ever
 * sent. The offending fields are already marked in red underneath the input, so
 * the toast adds noise and hides the real reason.
 *
 * FormKit pages do not need this: `form.validate()` resolves `{ valid }`
 * instead of rejecting, so validation returns before the save `try` block.
 */

/** True when `error` is rc-field-form's validation rejection, not a save failure. */
export const isFormValidationError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'errorFields' in error;

/** Number of fields rc-field-form marked invalid (0 when not a validation error). */
export const countFormValidationErrors = (error: unknown): number => {
  if (!isFormValidationError(error)) return 0;

  const fields = (error as { errorFields?: unknown }).errorFields;
  return Array.isArray(fields) ? fields.length : 0;
};
