import { date, number, objectId, oneOf, required, string, validateBody } from '../../../middleware/validate.js';

export const validateCreateActivity = validateBody({
  caseId: [required, objectId()],
  clientId: [required, objectId()],
  userId: [required, objectId()],
  activityType: [required, oneOf(['email', 'drafting', 'review', 'meeting', 'hearing', 'research', 'call', 'other'])],
  startedAt: [date()],
  endedAt: [date()],
  durationMinutes: [number({ min: 0 })],
  narrative: [string({ max: 2000 })],
});
