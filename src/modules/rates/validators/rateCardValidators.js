import {
  date,
  number,
  objectId,
  required,
  string,
  validateBody,
  validateParams,
  validateQuery,
} from '../../../middleware/validate.js';

export const validateCreateRateCard = validateBody({
  userId: [required, objectId()],
  caseId: [objectId()],
  activityCode: [string({ max: 80 })],
  ratePerHour: [required, number({ min: 0.01 })],
  effectiveFrom: [required, date()],
  effectiveTo: [date()],
});

export const validateUpdateRateCard = validateBody({
  userId: [objectId()],
  caseId: [objectId()],
  activityCode: [string({ max: 80 })],
  ratePerHour: [number({ min: 0.01 })],
  effectiveFrom: [date()],
  effectiveTo: [date()],
});

export const validateListRateCards = validateQuery({
  userId: [objectId()],
  caseId: [objectId()],
  activityCode: [string({ max: 80 })],
  activeOn: [date()],
});

export const validateResolveRate = validateQuery({
  userId: [required, objectId()],
  caseId: [objectId()],
  activityCode: [string({ max: 80 })],
  at: [date()],
});

export const validateRateCardIdParam = validateParams({
  id: [required, objectId()],
});
