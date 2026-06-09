import { boolean, date, number, objectId, oneOf, required, string, validateBody, validateParams } from '../../../middleware/validate.js';

const activityTypes = ['email', 'drafting', 'review', 'meeting', 'hearing', 'research', 'call', 'other'];
const workTools = ['gmail', 'google_chrome', 'billbot_ai', 'microsoft_word', 'google_docs', 'pdf_reader', 'phone', 'video_meeting', 'court', 'manual', 'other'];

export const validateWorkSessionId = validateParams({
  id: [required, objectId()],
});

export const validateStartWorkSession = validateBody({
  clientId: [required, objectId()],
  caseId: [required, objectId()],
  activityType: [required, oneOf(activityTypes)],
  activityCode: [string({ max: 80 })],
  workTool: [oneOf(workTools)],
  narrative: [string({ max: 2000 })],
  billable: [boolean()],
  timezone: [string({ max: 80 })],
  meterCaptureLevel: [oneOf(['none', 'active_window'])],
  idleAfterSeconds: [number({ min: 60, max: 3600 })],
  maxSessionMinutes: [number({ min: 1, max: 480 })],
});

export const validateHeartbeatWorkSession = validateBody({
  at: [date()],
  active: [boolean()],
  url: [string({ max: 2048 })],
  title: [string({ max: 300 })],
  inactiveSeconds: [number({ min: 0 })],
  activitySignal: [string({ max: 80 })],
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
