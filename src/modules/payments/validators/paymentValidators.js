import { date, number, objectId, oneOf, required, string, validateBody } from '../../../middleware/validate.js';

const methods = ['bank_transfer', 'cheque', 'cash', 'card', 'upi', 'wallet', 'other'];
const statuses = ['pending', 'cleared', 'failed'];
const transactionTypes = ['payment', 'write_off', 'refund'];

export const validateCreatePayment = validateBody({
  invoiceId: [required, objectId()],
  amount: [required, number({ min: 0 })],
  transactionType: [oneOf(transactionTypes)],
  method: [required, oneOf(methods)],
  receivedDate: [required, date()],
  reference: [string({ max: 160 })],
  status: [oneOf(statuses)],
  receivedBy: [objectId()],
  notes: [string({ max: 2000 })],
});

export const validateWriteOff = validateBody({
  invoiceId: [required, objectId()],
  amount: [required, number({ min: 0 })],
  notes: [required, string({ min: 1, max: 2000 })],
  reference: [string({ max: 160 })],
});

export const validatePortalPayment = validateBody({
  amount: [required, number({ min: 0 })],
  method: [required, oneOf(['card', 'upi', 'bank_transfer', 'wallet', 'other'])],
  payerName: [string({ max: 160 })],
  payerEmail: [string({ max: 254 })],
  reference: [string({ max: 160 })],
  notes: [string({ max: 1000 })],
});

export const validateReconcilePayment = validateBody({
  status: [required, oneOf(statuses)],
  receivedDate: [date()],
});
