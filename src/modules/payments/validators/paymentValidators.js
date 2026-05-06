import { date, number, objectId, oneOf, required, string, validateBody } from '../../../middleware/validate.js';

const methods = ['bank_transfer', 'cheque', 'cash', 'card', 'upi', 'wallet', 'other'];
const statuses = ['pending', 'cleared', 'failed'];

export const validateCreatePayment = validateBody({
  invoiceId: [required, objectId()],
  amount: [required, number({ min: 0 })],
  method: [required, oneOf(methods)],
  receivedDate: [required, date()],
  reference: [string({ max: 160 })],
  status: [oneOf(statuses)],
  receivedBy: [objectId()],
  notes: [string({ max: 2000 })],
});

export const validateReconcilePayment = validateBody({
  status: [required, oneOf(statuses)],
  receivedDate: [date()],
});
