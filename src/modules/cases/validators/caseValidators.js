import mongoose from 'mongoose';
import {
  array,
  date,
  objectId,
  oneOf,
  required,
  string,
  validateBody,
  validateParams,
  validateQuery,
} from '../../../middleware/validate.js';

export const caseStatuses = ['open', 'closed', 'pending', 'archived'];
export const billingTypes = ['hourly', 'fixed_fee', 'contingency', 'retainer'];
export const assignmentRoles = ['partner', 'associate', 'admin', 'primary'];
export const assignmentStatuses = ['active', 'inactive'];

const CASE_WRITE_FIELDS = new Set([
  'clientId',
  'title',
  'description',
  'status',
  'openedAt',
  'closedAt',
  'leadPartnerId',
  'managingLawyerId',
  'primaryLawyerId',
  'assignedUsers',
  'billingType',
  'case_type',
  'case_type_id',
]);

const CASE_STATUS_FIELDS = new Set(['status', 'closedAt']);

const ASSIGNMENT_CREATE_FIELDS = new Set([
  'caseId',
  'userId',
  'role',
  'startAt',
  'endAt',
  'status',
]);

const ASSIGNMENT_UPDATE_FIELDS = new Set([
  'role',
  'startAt',
  'endAt',
  'status',
]);

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const nullableObjectId = () => (value, field, payload) => {
  if (!hasOwn(payload, field)) return null;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return mongoose.Types.ObjectId.isValid(value) ? null : `${field} must be a valid ObjectId`;
};

const stringWhenPresent = ({ min = 0, max } = {}) => (value, field, payload) => {
  if (!hasOwn(payload, field)) return null;
  if (typeof value !== 'string') return `${field} must be a string`;
  const trimmed = value.trim();
  if (trimmed.length < min) return `${field} must be at least ${min} characters`;
  if (max && trimmed.length > max) return `${field} must be at most ${max} characters`;
  return null;
};

const positiveIntQuery = ({ min = 1, max } = {}) => (value, field) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return `${field} must be an integer`;
  if (parsed < min) return `${field} must be at least ${min}`;
  if (max !== undefined && parsed > max) return `${field} must be at most ${max}`;
  return null;
};

const dateOrder = () => (_value, _field, payload) => {
  if (!payload.startAt || !payload.endAt) return null;
  return Date.parse(payload.startAt) <= Date.parse(payload.endAt)
    ? null
    : 'endAt must be greater than or equal to startAt';
};

const caseDateOrder = () => (_value, _field, payload) => {
  if (!payload.openedAt || !payload.closedAt) return null;
  return Date.parse(payload.openedAt) <= Date.parse(payload.closedAt)
    ? null
    : 'closedAt must be greater than or equal to openedAt';
};

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

export const normalizeCasePayload = (req, _res, next) => {
  const body = req.body || {};

  trimStrings(body, [
    'clientId',
    'title',
    'description',
    'status',
    'billingType',
    'leadPartnerId',
    'managingLawyerId',
    'primaryLawyerId',
    'case_type',
    'case_type_id',
  ]);

  if (body.status) body.status = body.status.toLowerCase();
  if (body.billingType) body.billingType = body.billingType.toLowerCase();
  if (body.case_type_id === '') delete body.case_type_id;
  if (body.assignedUsers === null) body.assignedUsers = [];

  for (const field of ['leadPartnerId', 'managingLawyerId', 'primaryLawyerId']) {
    if (body[field] === '') delete body[field];
  }

  next();
};

export const normalizeAssignmentPayload = (req, _res, next) => {
  const body = req.body || {};
  trimStrings(body, ['caseId', 'userId', 'role', 'status']);
  if (body.role) body.role = body.role.toLowerCase();
  if (body.status) body.status = body.status.toLowerCase();
  dropEmptyOptional(body, ['role', 'status', 'startAt', 'endAt']);
  next();
};

export const validateCaseIdParam = validateParams({
  caseId: [required, objectId()],
});

export const validateClientIdParam = validateParams({
  clientId: [required, objectId()],
});

export const validateAssignmentIdParam = validateParams({
  id: [required, objectId()],
});

export const validateListCasesQuery = validateQuery({
  clientId: [objectId()],
  status: [oneOf(caseStatuses)],
  caseType: [string({ max: 120 })],
  caseTypeId: [objectId()],
  q: [string({ max: 160 })],
  page: [positiveIntQuery({ min: 1 })],
  limit: [positiveIntQuery({ min: 1, max: 100 })],
});

export const validateRelatedCaseQuery = validateQuery({
  page: [positiveIntQuery({ min: 1 })],
  limit: [positiveIntQuery({ min: 1, max: 100 })],
});

export const validateCaseRollupQuery = validateQuery({
  clearedOnly: [oneOf(['true', 'false'])],
});

export const validateAssignmentQuery = validateQuery({
  caseId: [objectId()],
  userId: [objectId()],
  status: [oneOf(assignmentStatuses)],
});

export const rejectUnknownCaseFields = rejectUnknownFields(CASE_WRITE_FIELDS);
export const rejectUnknownCaseStatusFields = rejectUnknownFields(CASE_STATUS_FIELDS);
export const rejectUnknownAssignmentCreateFields = rejectUnknownFields(ASSIGNMENT_CREATE_FIELDS);
export const rejectUnknownAssignmentUpdateFields = rejectUnknownFields(ASSIGNMENT_UPDATE_FIELDS);
export const requireCaseBodyFields = requireBodyFields(CASE_WRITE_FIELDS);
export const requireAssignmentUpdateFields = requireBodyFields(ASSIGNMENT_UPDATE_FIELDS);

export const validateCreateCase = validateBody({
  clientId: [required, objectId()],
  title: [required, string({ min: 1, max: 180 })],
  description: [string({ max: 4000 })],
  status: [oneOf(caseStatuses)],
  openedAt: [date()],
  closedAt: [date(), caseDateOrder()],
  billingType: [oneOf(billingTypes)],
  leadPartnerId: [nullableObjectId()],
  managingLawyerId: [nullableObjectId()],
  primaryLawyerId: [nullableObjectId()],
  assignedUsers: [array({ item: objectId() })],
  case_type: [string({ max: 120 })],
  case_type_id: [nullableObjectId()],
});

export const validateUpdateCase = validateBody({
  clientId: [objectId()],
  title: [stringWhenPresent({ min: 1, max: 180 })],
  description: [string({ max: 4000 })],
  status: [oneOf(caseStatuses)],
  openedAt: [date()],
  closedAt: [date(), caseDateOrder()],
  billingType: [oneOf(billingTypes)],
  leadPartnerId: [nullableObjectId()],
  managingLawyerId: [nullableObjectId()],
  primaryLawyerId: [nullableObjectId()],
  assignedUsers: [array({ item: objectId() })],
  case_type: [string({ max: 120 })],
  case_type_id: [nullableObjectId()],
});

export const validateCaseStatus = validateBody({
  status: [required, oneOf(caseStatuses)],
  closedAt: [date()],
});

export const validateCreateCaseAssignment = validateBody({
  caseId: [required, objectId()],
  userId: [required, objectId()],
  role: [required, oneOf(assignmentRoles)],
  startAt: [date()],
  endAt: [date(), dateOrder()],
  status: [oneOf(assignmentStatuses)],
});

export const validateUpdateCaseAssignment = validateBody({
  role: [oneOf(assignmentRoles)],
  startAt: [date()],
  endAt: [date(), dateOrder()],
  status: [oneOf(assignmentStatuses)],
});

export const caseWriteFields = CASE_WRITE_FIELDS;
