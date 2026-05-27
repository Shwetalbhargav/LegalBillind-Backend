import { boolean, number, objectId, oneOf, required, string, validateBody } from '../../../middleware/validate.js';

const assistModes = ['draft_email', 'summarize_text', 'analyze_text', 'billable_narrative'];

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

export const validateAssist = validateBody({
  mode: [required, oneOf(assistModes)],
  input: [required, string({ min: 1, max: 12000 })],
});
