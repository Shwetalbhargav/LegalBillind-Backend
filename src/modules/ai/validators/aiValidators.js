import { boolean, number, objectId, oneOf, required, string, validateBody } from '../../../middleware/validate.js';

const assistModes = ['draft_email', 'summarize_text', 'analyze_text', 'billable_narrative'];
const documentTypes = ['note', 'brief', 'draft', 'order', 'evidence', 'correspondence', 'research', 'other'];

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

export const validateMatterDocument = validateBody({
  caseId: [required, objectId()],
  clientId: [required, objectId()],
  title: [required, string({ min: 1, max: 240 })],
  documentType: [oneOf(documentTypes)],
  content: [required, string({ min: 1, max: 50000 })],
});

export const validateGenerateDocument = validateBody({
  caseId: [required, objectId()],
  clientId: [objectId()],
  documentType: [required, string({ min: 1, max: 80 })],
  instructions: [required, string({ min: 1, max: 12000 })],
});

export const validateMatterChat = validateBody({
  caseId: [required, objectId()],
  question: [required, string({ min: 1, max: 4000 })],
});
