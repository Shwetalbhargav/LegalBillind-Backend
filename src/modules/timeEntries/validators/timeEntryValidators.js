import { date, number, objectId, oneOf, required, string, validateBody, validateParams } from '../../../middleware/validate.js';

const statuses = ['draft', 'submitted', 'approved', 'billed', 'paid', 'rejected'];

export const validateCreateTimeEntry = validateBody({
  caseId: [required, objectId()],
  clientId: [required, objectId()],
  userId: [required, objectId()],
  narrative: [required, string({ min: 1, max: 4000 })],
  billableMinutes: [number({ min: 0 })],
  nonbillableMinutes: [number({ min: 0 })],
  rateApplied: [number({ min: 0 })],
  amount: [number({ min: 0 })],
  date: [date()],
  status: [oneOf(statuses)],
});

export const validateUpdateTimeEntry = validateBody({
  caseId: [objectId()],
  clientId: [objectId()],
  userId: [objectId()],
  narrative: [string({ min: 1, max: 4000 })],
  billableMinutes: [number({ min: 0 })],
  nonbillableMinutes: [number({ min: 0 })],
  rateApplied: [number({ min: 0 })],
  amount: [number({ min: 0 })],
  date: [date()],
  status: [oneOf(statuses)],
});

export const validateActivityIdParam = validateParams({
  activityId: [required, objectId()],
});
