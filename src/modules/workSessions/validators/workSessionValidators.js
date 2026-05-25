import { boolean, date, objectId, oneOf, required, string, validateBody, validateParams } from '../../../middleware/validate.js';

const activityTypes = ['email', 'drafting', 'review', 'meeting', 'hearing', 'research', 'call', 'other'];

export const validateWorkSessionId = validateParams({
  id: [required, objectId()],
});

export const validateStartWorkSession = validateBody({
  clientId: [required, objectId()],
  caseId: [required, objectId()],
  activityType: [required, oneOf(activityTypes)],
  activityCode: [string({ max: 80 })],
  narrative: [string({ max: 2000 })],
  billable: [boolean()],
  timezone: [string({ max: 80 })],
});

export const validateHeartbeatWorkSession = validateBody({
  at: [date()],
  active: [boolean()],
  url: [string({ max: 2048 })],
  title: [string({ max: 300 })],
});

export const validatePauseWorkSession = validateBody({
  reason: [string({ max: 500 })],
});

export const validateStopWorkSession = validateBody({
  endedAt: [date()],
  finalNarrative: [string({ max: 2000 })],
  createTimeEntry: [boolean()],
  submitTimeEntry: [boolean()],
});

export const validateDiscardWorkSession = validateBody({
  reason: [string({ max: 500 })],
});
