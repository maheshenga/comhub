import { describe, expect, it } from 'vitest';

import { isDesktopFormValidationError } from '../DesktopControlCenter/desktopSettingsForm';
import { countFormValidationErrors, isFormValidationError } from './adminFormErrors';

/** The exact shape rc-field-form rejects `validateFields()` with. */
const validationError = (count: number) => ({
  errorFields: Array.from({ length: count }, (_, index) => ({
    errors: ['Field is required'],
    name: ['field', index],
    value: '',
  })),
  outOfDate: false,
  values: {},
});

describe('adminFormErrors', () => {
  describe('isFormValidationError', () => {
    it('detects rc-field-form validation rejections', () => {
      expect(isFormValidationError(validationError(1))).toBe(true);
      expect(isFormValidationError(validationError(3))).toBe(true);
    });

    it('does not treat real save failures as validation errors', () => {
      expect(isFormValidationError(new Error('APP_SETTINGS_REVISION_CONFLICT'))).toBe(false);
      expect(isFormValidationError(new Error('network down'))).toBe(false);
      expect(isFormValidationError('string error')).toBe(false);
      expect(isFormValidationError(undefined)).toBe(false);
      expect(isFormValidationError(null)).toBe(false);
      expect(isFormValidationError({ code: 'INTERNAL_SERVER_ERROR' })).toBe(false);
    });
  });

  describe('countFormValidationErrors', () => {
    it('counts the offending fields', () => {
      expect(countFormValidationErrors(validationError(2))).toBe(2);
      expect(countFormValidationErrors(validationError(5))).toBe(5);
    });

    it('returns 0 for anything that is not a validation rejection', () => {
      expect(countFormValidationErrors(new Error('boom'))).toBe(0);
      expect(countFormValidationErrors(undefined)).toBe(0);
      // `errorFields` present but not an array must not throw or fabricate a count.
      expect(countFormValidationErrors({ errorFields: 'oops' })).toBe(0);
      expect(countFormValidationErrors({})).toBe(0);
    });
  });

  it('stays behaviour-compatible with the Desktop-prefixed detector it replaces', () => {
    const samples: unknown[] = [
      validationError(1),
      validationError(4),
      new Error('x'),
      undefined,
      null,
      'str',
      42,
      {},
      { errorFields: [] },
    ];

    for (const sample of samples) {
      expect(isFormValidationError(sample)).toBe(isDesktopFormValidationError(sample));
    }
  });
});
