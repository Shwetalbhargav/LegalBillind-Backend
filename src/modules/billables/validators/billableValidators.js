import { date, number, objectId, oneOf, required, string, validateBody } from '../../../middleware/validate.js';

const categories = [
  'Email drafting/review',
  'Contract drafting/review',
  'Legal research',
  'Client consultation (calls/meetings)',
  'Case preparation/documentation',
  'Court appearance or hearing attendance',
  'Negotiation/settlement discussions',
  'IP filing & compliance work',
  'Dispute resolution activities',
  'Miscellaneous administrative legal work',
];
const statuses = ['pending', 'approved', 'rejected', 'billed', 'Pending', 'Logged', 'Failed'];

export const validateCreateBillable = validateBody({
  caseId: [required, objectId()],
  clientId: [required, objectId()],
  userId: [required, objectId()],
  category: [oneOf(categories)],
  description: [required, string({ min: 1, max: 4000 })],
  durationMinutes: [required, number({ min: 0 })],
  rate: [number({ min: 0 })],
  amount: [number({ min: 0 })],
  date: [date()],
  status: [oneOf(statuses)],
});

export const validateUpdateBillable = validateBody({
  caseId: [objectId()],
  clientId: [objectId()],
  userId: [objectId()],
  category: [oneOf(categories)],
  description: [string({ min: 1, max: 4000 })],
  durationMinutes: [number({ min: 0 })],
  rate: [number({ min: 0 })],
  amount: [number({ min: 0 })],
  date: [date()],
  status: [oneOf(statuses)],
});
