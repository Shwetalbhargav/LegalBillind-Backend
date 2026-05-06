import { date, number, objectId, required, string, validateBody, validateQuery } from '../../../middleware/validate.js';

export const validateCreateRateCard = validateBody({
  userId: [required, objectId()],
  caseId: [objectId()],
  activityCode: [string({ max: 80 })],
  ratePerHour: [required, number({ min: 0 })],
  effectiveFrom: [required, date()],
  effectiveTo: [date()],
});

export const validateUpdateRateCard = validateBody({
  userId: [objectId()],
  caseId: [objectId()],
  activityCode: [string({ max: 80 })],
  ratePerHour: [number({ min: 0 })],
  effectiveFrom: [date()],
  effectiveTo: [date()],
});

export const validateResolveRate = validateQuery({
  userId: [required, objectId()],
  caseId: [objectId()],
  activityCode: [string({ max: 80 })],
  at: [date()],
});
