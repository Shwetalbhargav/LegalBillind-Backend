import { date, number, objectId, required, string, validateBody } from '../../../middleware/validate.js';

export const validateCreateEmailEntry = validateBody({
  recipient: [required, string({ min: 1, max: 254 })],
  subject: [required, string({ min: 1, max: 300 })],
  body: [string({ max: 10000 })],
  userId: [objectId()],
  clientId: [objectId()],
  caseId: [objectId()],
  mappedClientId: [objectId()],
  mappedCaseId: [objectId()],
  typingTimeSeconds: [number({ min: 0 })],
  typingTimeMinutes: [number({ min: 0 })],
  workDate: [date()],
  rate: [number({ min: 0 })],
});

export const validateUpdateEmailEntry = validateBody({
  recipient: [string({ min: 1, max: 254 })],
  subject: [string({ min: 1, max: 300 })],
  body: [string({ max: 10000 })],
  userId: [objectId()],
  clientId: [objectId()],
  caseId: [objectId()],
  mappedClientId: [objectId()],
  mappedCaseId: [objectId()],
  typingTimeSeconds: [number({ min: 0 })],
  typingTimeMinutes: [number({ min: 0 })],
  workDate: [date()],
  rate: [number({ min: 0 })],
});
