import {
  boolean,
  date,
  number,
  objectId,
  oneOf,
  string,
  validateBody,
} from '../../../middleware/validate.js';

const SOURCE_VALUES = ['gmail', 'extension', 'research'];
const STATUS_VALUES = ['captured', 'mapped', 'converted', 'billed'];

const createFields = [
  'recipient',
  'subject',
  'body',
  'userId',
  'userEmail',
  'clientId',
  'caseId',
  'mappedClientId',
  'mappedCaseId',
  'typingTimeSeconds',
  'typingTimeMinutes',
  'typingTimeMinSec',
  'durationMinutes',
  'minutes',
  'workDate',
  'date',
  'rate',
  'billableSummary',
  'source',
  'sourceRef',
  'messageId',
  'threadId',
  'url',
  'domain',
  'status',
  'schemaVersion',
  'meta',
  'selectedText',
  'autoConvert',
];

const updateFields = createFields.filter((field) => !['autoConvert'].includes(field));
const mapFields = ['clientId', 'caseId', 'convert'];

const isMissing = (value) => value === undefined || value === null || value === '';

const rejectUnknownFields = (allowedFields) => (req, res, next) => {
  const unknown = Object.keys(req.body || {}).filter((field) => !allowedFields.includes(field));
  if (unknown.length) {
    return res.status(400).json({
      ok: false,
      message: 'Validation failed',
      errors: unknown.map((field) => ({ field, message: `${field} is not allowed` })),
    });
  }
  next();
};

const normalizeStringField = (payload, field) => {
  if (typeof payload[field] === 'string') payload[field] = payload[field].trim();
};

const normalizePayload = (req, _res, next) => {
  const payload = req.body || {};
  [
    'recipient',
    'subject',
    'body',
    'userEmail',
    'source',
    'sourceRef',
    'messageId',
    'threadId',
    'url',
    'domain',
    'status',
    'billableSummary',
    'typingTimeMinSec',
    'selectedText',
  ].forEach((field) => normalizeStringField(payload, field));

  if (payload.userEmail) payload.userEmail = payload.userEmail.toLowerCase();
  if (payload.source) payload.source = payload.source.toLowerCase();
  if (payload.status) payload.status = payload.status.toLowerCase();
  if (payload.domain) payload.domain = payload.domain.toLowerCase().replace(/^www\./, '');
  if (!payload.domain && payload.url) {
    try {
      payload.domain = new URL(payload.url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      // URL validation will report the bad value if present.
    }
  }
  if (payload.date && !payload.workDate) payload.workDate = payload.date;
  next();
};

const validateSemantics = ({ partial = false } = {}) => (req, res, next) => {
  const payload = req.body || {};
  const errors = [];
  const source = payload.source || 'extension';
  const hasDuration =
    !isMissing(payload.typingTimeMinutes) ||
    !isMissing(payload.typingTimeSeconds) ||
    !isMissing(payload.durationMinutes) ||
    !isMissing(payload.minutes);

  if (!partial) {
    if (!payload.subject) errors.push({ field: 'subject', message: 'subject is required' });
    if (source !== 'research' && !payload.recipient) {
      errors.push({ field: 'recipient', message: 'recipient is required for email capture' });
    }
    if (!hasDuration) {
      errors.push({ field: 'typingTimeMinutes', message: 'duration is required' });
    }
  }

  if (payload.meta !== undefined && (payload.meta === null || typeof payload.meta !== 'object' || Array.isArray(payload.meta))) {
    errors.push({ field: 'meta', message: 'meta must be an object' });
  }

  if (payload.autoConvert && (!payload.clientId || !payload.caseId)) {
    errors.push({ field: 'autoConvert', message: 'autoConvert requires clientId and caseId' });
  }

  if (errors.length) {
    return res.status(400).json({ ok: false, message: 'Validation failed', errors });
  }
  next();
};

const validateUrlField = (value, field) => {
  if (isMissing(value)) return null;
  try {
    new URL(value);
    return null;
  } catch {
    return `${field} must be a valid URL`;
  }
};

const baseSchema = {
  recipient: [string({ min: 1, max: 254 })],
  subject: [string({ min: 1, max: 300 })],
  body: [string({ max: 10000 })],
  userId: [objectId()],
  userEmail: [string({ min: 3, max: 254 })],
  clientId: [objectId()],
  caseId: [objectId()],
  mappedClientId: [objectId()],
  mappedCaseId: [objectId()],
  typingTimeSeconds: [number({ min: 0 })],
  typingTimeMinutes: [number({ min: 0 })],
  typingTimeMinSec: [string({ max: 30 })],
  durationMinutes: [number({ min: 0 })],
  minutes: [number({ min: 0 })],
  workDate: [date()],
  date: [date()],
  rate: [number({ min: 0 })],
  billableSummary: [string({ max: 2000 })],
  source: [oneOf(SOURCE_VALUES)],
  sourceRef: [string({ min: 1, max: 512 })],
  messageId: [string({ max: 255 })],
  threadId: [string({ max: 255 })],
  url: [string({ max: 2048 }), validateUrlField],
  domain: [string({ max: 255 })],
  status: [oneOf(STATUS_VALUES)],
  schemaVersion: [number({ min: 1 })],
  selectedText: [string({ max: 10000 })],
  autoConvert: [boolean()],
};

export const validateCreateEmailEntry = [
  rejectUnknownFields(createFields),
  normalizePayload,
  validateBody(baseSchema),
  validateSemantics(),
];

export const validateUpdateEmailEntry = [
  rejectUnknownFields(updateFields),
  normalizePayload,
  validateBody(baseSchema),
  validateSemantics({ partial: true }),
];

export const validateMapEmailEntry = [
  rejectUnknownFields(mapFields),
  normalizePayload,
  validateBody({
    clientId: [objectId()],
    caseId: [objectId()],
    convert: [boolean()],
  }),
];

export const emailEntryStatusValues = STATUS_VALUES;
export const emailEntrySourceValues = SOURCE_VALUES;
