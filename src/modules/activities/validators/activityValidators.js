import { boolean, date, number, objectId, oneOf, required, string, validateBody, validateParams, validateQuery } from '../../../middleware/validate.js';

const activityTypes = ['email', 'drafting', 'review', 'meeting', 'hearing', 'research', 'call', 'other'];
const activitySources = ['gmail', 'extension', 'research', 'manual', 'meter', 'integration', 'system'];
const workTools = ['gmail', 'google_chrome', 'billbot_ai', 'microsoft_word', 'google_docs', 'pdf_reader', 'phone', 'video_meeting', 'court', 'manual', 'other'];
const activityStatuses = ['captured', 'reviewed', 'converted', 'ignored', 'locked', 'voided'];
const roundingPolicies = ['exact', 'six_minute', 'fifteen_minute'];
const activitySortFields = [
  'createdAt',
  '-createdAt',
  'startedAt',
  '-startedAt',
  'endedAt',
  '-endedAt',
  'durationMinutes',
  '-durationMinutes',
  'roundedDurationMinutes',
  '-roundedDurationMinutes',
  'workDate',
  '-workDate',
  'activityType',
  '-activityType',
  'status',
  '-status',
];

const CREATE_FIELDS = new Set([
  'caseId',
  'clientId',
  'userId',
  'activityType',
  'startedAt',
  'endedAt',
  'durationMinutes',
  'roundingPolicy',
  'billable',
  'durationOverrideReason',
  'source',
  'workTool',
  'sourceRef',
  'narrative',
  'activityCode',
  'timezone',
  'calendarEvent',
]);

const UPDATE_FIELDS = new Set([
  'activityType',
  'startedAt',
  'endedAt',
  'durationMinutes',
  'roundingPolicy',
  'billable',
  'durationOverrideReason',
  'source',
  'workTool',
  'sourceRef',
  'narrative',
  'activityCode',
  'timezone',
  'calendarEvent',
]);

const REASON_FIELDS = new Set(['reason']);

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const rejectUnknownFields = (allowedFields) => (req, res, next) => {
  const body = req.body || {};
  if (!isPlainObject(body)) {
    return res.status(400).json({
      ok: false,
      message: 'Validation failed',
      errors: [{ field: 'body', message: 'body must be an object' }],
    });
  }

  const unknown = Object.keys(body).filter((field) => !allowedFields.has(field));
  if (unknown.length) {
    return res.status(400).json({
      ok: false,
      message: 'Validation failed',
      errors: unknown.map((field) => ({ field, message: `${field} is not allowed` })),
    });
  }

  next();
};

const trimStrings = (body, fields) => {
  for (const field of fields) {
    if (typeof body[field] === 'string') body[field] = body[field].trim();
  }
};

const dropEmptyOptional = (body, fields) => {
  for (const field of fields) {
    if (body[field] === '') delete body[field];
  }
};

const positiveIntQuery = ({ min = 1, max } = {}) => (value, field) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return `${field} must be an integer`;
  if (parsed < min) return `${field} must be at least ${min}`;
  if (max !== undefined && parsed > max) return `${field} must be at most ${max}`;
  return null;
};

const durationOrTimeRange = () => (_value, _field, payload) => {
  const hasDuration = hasOwn(payload, 'durationMinutes') && payload.durationMinutes !== undefined && payload.durationMinutes !== null && payload.durationMinutes !== '';
  const hasStart = hasOwn(payload, 'startedAt') && payload.startedAt !== undefined && payload.startedAt !== null && payload.startedAt !== '';
  const hasEnd = hasOwn(payload, 'endedAt') && payload.endedAt !== undefined && payload.endedAt !== null && payload.endedAt !== '';

  if (hasDuration || (hasStart && hasEnd)) return null;
  return 'durationMinutes or both startedAt and endedAt are required';
};

const chronologicalRange = () => (_value, _field, payload) => {
  if (!payload.startedAt || !payload.endedAt) return null;
  const start = Date.parse(payload.startedAt);
  const end = Date.parse(payload.endedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return end >= start ? null : 'endedAt must be greater than or equal to startedAt';
};

const fromBeforeTo = () => (_value, _field, payload) => {
  if (!payload.from || !payload.to) return null;
  const from = Date.parse(payload.from);
  const to = Date.parse(payload.to);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return to >= from ? null : 'to must be greater than or equal to from';
};

const requireBodyFields = (allowedFields) => (req, res, next) => {
  const body = req.body || {};
  const hasAllowedField = Object.keys(body).some((field) => allowedFields.has(field));
  if (!hasAllowedField) {
    return res.status(400).json({
      ok: false,
      message: 'Validation failed',
      errors: [{ field: 'body', message: 'At least one field is required' }],
    });
  }

  next();
};

export const normalizeActivityPayload = (req, _res, next) => {
  const body = req.body || {};
  trimStrings(body, [
    'caseId',
    'clientId',
    'userId',
    'activityType',
    'source',
    'workTool',
    'sourceRef',
    'narrative',
    'activityCode',
    'timezone',
    'roundingPolicy',
    'durationOverrideReason',
  ]);

  if (body.activityType) body.activityType = body.activityType.toLowerCase();
  if (body.source) body.source = body.source.toLowerCase();
  if (body.workTool) body.workTool = body.workTool.toLowerCase();
  if (body.roundingPolicy) body.roundingPolicy = body.roundingPolicy.toLowerCase();
  dropEmptyOptional(body, ['userId', 'startedAt', 'endedAt', 'durationMinutes', 'source', 'workTool', 'sourceRef', 'narrative', 'activityCode', 'timezone', 'roundingPolicy', 'durationOverrideReason']);

  if (body.billable === 'true') body.billable = true;
  if (body.billable === 'false') body.billable = false;

  next();
};

export const normalizeActivityReasonPayload = (req, _res, next) => {
  const body = req.body || {};
  trimStrings(body, ['reason']);
  dropEmptyOptional(body, ['reason']);
  next();
};

export const rejectUnknownActivityCreateFields = rejectUnknownFields(CREATE_FIELDS);
export const rejectUnknownActivityUpdateFields = rejectUnknownFields(UPDATE_FIELDS);
export const rejectUnknownActivityReasonFields = rejectUnknownFields(REASON_FIELDS);
export const requireActivityUpdateFields = requireBodyFields(UPDATE_FIELDS);

export const validateActivityIdParam = validateParams({
  activityId: [required, objectId()],
});

export const validateListActivitiesQuery = validateQuery({
  caseId: [objectId()],
  clientId: [objectId()],
  userId: [objectId()],
  activityType: [oneOf(activityTypes)],
  status: [oneOf(activityStatuses)],
  billable: [oneOf(['true', 'false'])],
  source: [oneOf(activitySources)],
  from: [date(), fromBeforeTo()],
  to: [date()],
  page: [positiveIntQuery({ min: 1 })],
  limit: [positiveIntQuery({ min: 1, max: 100 })],
  sort: [oneOf(activitySortFields)],
});

export const validateCreateActivity = validateBody({
  caseId: [required, objectId()],
  clientId: [required, objectId()],
  userId: [objectId()],
  activityType: [required, oneOf(activityTypes)],
  startedAt: [date()],
  endedAt: [date(), chronologicalRange()],
  durationMinutes: [number({ min: 0 }), durationOrTimeRange()],
  roundingPolicy: [oneOf(roundingPolicies)],
  billable: [boolean()],
  durationOverrideReason: [string({ max: 500 })],
  source: [oneOf(activitySources)],
  workTool: [oneOf(workTools)],
  sourceRef: [string({ max: 255 })],
  narrative: [string({ max: 2000 })],
  activityCode: [string({ max: 80 })],
  timezone: [string({ max: 80 })],
});

export const validateUpdateActivity = validateBody({
  activityType: [oneOf(activityTypes)],
  startedAt: [date()],
  endedAt: [date(), chronologicalRange()],
  durationMinutes: [number({ min: 0 })],
  roundingPolicy: [oneOf(roundingPolicies)],
  billable: [boolean()],
  durationOverrideReason: [string({ max: 500 })],
  source: [oneOf(activitySources)],
  workTool: [oneOf(workTools)],
  sourceRef: [string({ max: 255 })],
  narrative: [string({ max: 2000 })],
  activityCode: [string({ max: 80 })],
  timezone: [string({ max: 80 })],
});

export const validateActivityReason = validateBody({
  reason: [string({ max: 500 })],
});
