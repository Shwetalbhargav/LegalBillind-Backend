import mongoose from 'mongoose';

const isMissing = (value) => value === undefined || value === null || value === '';

const runSchema = (schema, source) => (req, res, next) => {
  const payload = req[source] || {};
  const errors = [];

  for (const [field, checks] of Object.entries(schema)) {
    const value = payload[field];
    for (const check of checks) {
      const message = check(value, field, payload);
      if (message) errors.push({ field, message });
    }
  }

  if (errors.length) {
    return res.status(400).json({
      ok: false,
      message: 'Validation failed',
      errors,
    });
  }

  next();
};

export const validateBody = (schema) => runSchema(schema, 'body');
export const validateParams = (schema) => runSchema(schema, 'params');
export const validateQuery = (schema) => runSchema(schema, 'query');

export const required = (value, field) => (
  isMissing(value) ? `${field} is required` : null
);

export const string = ({ min = 0, max } = {}) => (value, field) => {
  if (isMissing(value)) return null;
  if (typeof value !== 'string') return `${field} must be a string`;
  const trimmed = value.trim();
  if (trimmed.length < min) return `${field} must be at least ${min} characters`;
  if (max && trimmed.length > max) return `${field} must be at most ${max} characters`;
  return null;
};

export const number = ({ min, max } = {}) => (value, field) => {
  if (isMissing(value)) return null;
  if (typeof value !== 'number' || Number.isNaN(value)) return `${field} must be a number`;
  if (min !== undefined && value < min) return `${field} must be at least ${min}`;
  if (max !== undefined && value > max) return `${field} must be at most ${max}`;
  return null;
};

export const boolean = () => (value, field) => {
  if (isMissing(value)) return null;
  return typeof value === 'boolean' ? null : `${field} must be a boolean`;
};

export const objectId = () => (value, field) => {
  if (isMissing(value)) return null;
  return mongoose.Types.ObjectId.isValid(value) ? null : `${field} must be a valid ObjectId`;
};

export const date = () => (value, field) => {
  if (isMissing(value)) return null;
  return Number.isNaN(Date.parse(value)) ? `${field} must be a valid date` : null;
};

export const oneOf = (values) => (value, field) => {
  if (isMissing(value)) return null;
  return values.includes(value) ? null : `${field} must be one of: ${values.join(', ')}`;
};

export const matches = (pattern, description) => (value, field) => {
  if (isMissing(value)) return null;
  return pattern.test(String(value)) ? null : `${field} must match ${description}`;
};

export const array = ({ min, item } = {}) => (value, field) => {
  if (isMissing(value)) return null;
  if (!Array.isArray(value)) return `${field} must be an array`;
  if (min !== undefined && value.length < min) return `${field} must contain at least ${min} item(s)`;
  if (item) {
    const invalidIndex = value.findIndex((entry) => item(entry, field) !== null);
    if (invalidIndex !== -1) return `${field}[${invalidIndex}] is invalid`;
  }
  return null;
};
