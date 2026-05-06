import { boolean, number, required, string, validateBody } from '../../../middleware/validate.js';

export const validateCreateFirm = validateBody({
  name: [required, string({ min: 1, max: 180 })],
  currency: [string({ min: 3, max: 3 })],
});

export const validateUpdateFirm = validateBody({
  name: [string({ min: 1, max: 180 })],
  currency: [string({ min: 3, max: 3 })],
});

export const validateCurrency = validateBody({
  currency: [required, string({ min: 3, max: 3 })],
});

export const validateTaxSettings = validateBody({
  taxName: [string({ max: 80 })],
  taxRatePct: [number({ min: 0, max: 100 })],
  inclusive: [boolean()],
});

export const validateBillingPreferences = validateBody({
  defaultRate: [number({ min: 0 })],
  autoSync: [boolean()],
});
