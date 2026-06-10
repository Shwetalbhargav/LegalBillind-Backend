import { array, date, number, objectId, required, string, validateBody } from '../../../middleware/validate.js';

export const validateGenerateFromTime = validateBody({
  clientId: [required, objectId()],
  caseId: [objectId()],
  timeEntryIds: [required, array({ min: 1, item: objectId() })],
  currency: [string({ min: 3, max: 3 })],
  dueDate: [date()],
  periodStart: [date()],
  periodEnd: [date()],
  createdBy: [objectId()],
});

export const validateGenerateFromBillables = validateBody({
  clientId: [required, objectId()],
  caseId: [objectId()],
  billableIds: [required, array({ min: 1, item: objectId() })],
  currency: [string({ min: 3, max: 3 })],
  dueDate: [date()],
  periodStart: [date()],
  periodEnd: [date()],
  createdBy: [objectId()],
});

export const validateSendInvoice = validateBody({
  dueDate: [date()],
  pdfUrl: [string({ max: 2000 })],
  to: [string({ max: 320 })],
  subject: [string({ max: 300 })],
  message: [string({ max: 2000 })],
});

export const validateInvoiceLine = validateBody({
  timeEntryId: [objectId()],
  description: [required, string({ min: 1, max: 4000 })],
  qtyHours: [required, number({ min: 0 })],
  rate: [required, number({ min: 0 })],
  amount: [number({ min: 0 })],
  billableId: [objectId()],
  taxCategory: [string({ max: 80 })],
});
