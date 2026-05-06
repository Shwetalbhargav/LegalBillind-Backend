import { array, date, objectId, oneOf, required, string, validateBody } from '../../../middleware/validate.js';

const caseStatuses = ['open', 'closed', 'pending', 'archived'];
const billingTypes = ['hourly', 'fixed_fee', 'contingency', 'retainer'];

export const validateCreateCase = validateBody({
  clientId: [required, objectId()],
  title: [required, string({ min: 1, max: 180 })],
  status: [oneOf(caseStatuses)],
  billingType: [oneOf(billingTypes)],
  primaryLawyerId: [objectId()],
  assignedUsers: [array({ item: objectId() })],
});

export const validateUpdateCase = validateBody({
  clientId: [objectId()],
  title: [string({ min: 1, max: 180 })],
  status: [oneOf(caseStatuses)],
  billingType: [oneOf(billingTypes)],
  primaryLawyerId: [objectId()],
  assignedUsers: [array({ item: objectId() })],
});

export const validateCaseStatus = validateBody({
  status: [required, oneOf(caseStatuses)],
  closedAt: [date()],
});
