import { boolean, number, objectId, required, string, validateBody } from '../../../middleware/validate.js';

export const validateGenerateEmail = validateBody({
  prompt: [required, string({ min: 1, max: 4000 })],
});

export const validateEmailToBillable = validateBody({
  userId: [required, objectId()],
  to: [required, string({ min: 1, max: 254 })],
  subject: [string({ max: 300 })],
  body: [string({ max: 10000 })],
  minutes: [number({ min: 0 })],
  dryRun: [boolean()],
});
