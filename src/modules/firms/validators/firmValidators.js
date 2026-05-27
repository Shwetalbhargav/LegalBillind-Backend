import {
  boolean,
  number,
  objectId,
  required,
  string,
  validateBody,
  validateParams,
} from '../../../middleware/validate.js';

export const FIRM_WRITE_FIELDS = new Set([
  'name',
  'currency',
  'taxSettings',
  'address',
  'billingPreferences',
]);

export const TAX_SETTINGS_FIELDS = new Set(['taxName', 'taxRatePct', 'inclusive']);
export const ADDRESS_FIELDS = new Set(['line1', 'line2', 'city', 'state', 'postalCode', 'country']);
export const BILLING_PREFERENCES_FIELDS = new Set(['defaultRate', 'autoSync']);
export const CURRENCY_FIELDS = new Set(['currency']);

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const validationFailed = (res, errors) =>
  res.status(400).json({
    ok: false,
    message: 'Validation failed',
    errors,
  });

const rejectUnknownNestedFields = (body, field, allowedFields, errors) => {
  if (!hasOwn(body, field)) return;
  const value = body[field];
  if (!isPlainObject(value)) {
    errors.push({ field, message: `${field} must be an object` });
    return;
  }

  Object.keys(value)
    .filter((nestedField) => !allowedFields.has(nestedField))
    .forEach((nestedField) => {
      errors.push({
        field: `${field}.${nestedField}`,
        message: `${field}.${nestedField} is not allowed`,
      });
    });
};

const hasAllowedField = (body, allowedFields) =>
  Object.keys(body || {}).some((field) => allowedFields.has(field));

const hasAllowedNestedField = (body, allowedFields) =>
  Object.keys(body || {}).some((field) => allowedFields.has(field));

const trimString = (obj, field) => {
  if (typeof obj[field] === 'string') obj[field] = obj[field].trim();
};

const numberFromInput = (obj, field) => {
  if (obj[field] === '') {
    delete obj[field];
    return;
  }

  if (typeof obj[field] === 'string') {
    const parsed = Number(obj[field]);
    if (!Number.isNaN(parsed)) obj[field] = parsed;
  }
};

const booleanFromInput = (obj, field) => {
  if (obj[field] === '') {
    delete obj[field];
    return;
  }

  if (typeof obj[field] === 'string') {
    const normalized = obj[field].trim().toLowerCase();
    if (normalized === 'true') obj[field] = true;
    if (normalized === 'false') obj[field] = false;
  }
};

const validateAddressStrings = (address, errors) => {
  if (!isPlainObject(address)) return;
  for (const field of ADDRESS_FIELDS) {
    if (!hasOwn(address, field) || address[field] === undefined || address[field] === null || address[field] === '') continue;
    if (typeof address[field] !== 'string') {
      errors.push({ field: `address.${field}`, message: `address.${field} must be a string` });
      continue;
    }
    if (address[field].trim().length > 180) {
      errors.push({ field: `address.${field}`, message: `address.${field} must be at most 180 characters` });
    }
  }
};

const validateNestedValues = (body, errors) => {
  const { taxSettings, billingPreferences, address } = body;

  if (isPlainObject(taxSettings)) {
    if (hasOwn(taxSettings, 'taxName') && taxSettings.taxName !== undefined && taxSettings.taxName !== null) {
      if (typeof taxSettings.taxName !== 'string') {
        errors.push({ field: 'taxSettings.taxName', message: 'taxSettings.taxName must be a string' });
      } else if (taxSettings.taxName.trim().length > 80) {
        errors.push({ field: 'taxSettings.taxName', message: 'taxSettings.taxName must be at most 80 characters' });
      }
    }

    if (hasOwn(taxSettings, 'taxRatePct') && taxSettings.taxRatePct !== undefined && taxSettings.taxRatePct !== null) {
      if (typeof taxSettings.taxRatePct !== 'number' || Number.isNaN(taxSettings.taxRatePct)) {
        errors.push({ field: 'taxSettings.taxRatePct', message: 'taxSettings.taxRatePct must be a number' });
      } else if (taxSettings.taxRatePct < 0 || taxSettings.taxRatePct > 100) {
        errors.push({ field: 'taxSettings.taxRatePct', message: 'taxSettings.taxRatePct must be between 0 and 100' });
      }
    }

    if (
      hasOwn(taxSettings, 'inclusive') &&
      taxSettings.inclusive !== undefined &&
      taxSettings.inclusive !== null &&
      typeof taxSettings.inclusive !== 'boolean'
    ) {
      errors.push({ field: 'taxSettings.inclusive', message: 'taxSettings.inclusive must be a boolean' });
    }
  }

  if (isPlainObject(billingPreferences)) {
    if (
      hasOwn(billingPreferences, 'defaultRate') &&
      billingPreferences.defaultRate !== undefined &&
      billingPreferences.defaultRate !== null
    ) {
      if (typeof billingPreferences.defaultRate !== 'number' || Number.isNaN(billingPreferences.defaultRate)) {
        errors.push({ field: 'billingPreferences.defaultRate', message: 'billingPreferences.defaultRate must be a number' });
      } else if (billingPreferences.defaultRate < 0) {
        errors.push({ field: 'billingPreferences.defaultRate', message: 'billingPreferences.defaultRate must be at least 0' });
      }
    }

    if (
      hasOwn(billingPreferences, 'autoSync') &&
      billingPreferences.autoSync !== undefined &&
      billingPreferences.autoSync !== null &&
      typeof billingPreferences.autoSync !== 'boolean'
    ) {
      errors.push({ field: 'billingPreferences.autoSync', message: 'billingPreferences.autoSync must be a boolean' });
    }
  }

  validateAddressStrings(address, errors);
};

export const rejectUnknownFirmFields = (allowedFields = FIRM_WRITE_FIELDS) => (req, res, next) => {
  const body = req.body || {};
  if (!isPlainObject(body)) {
    return validationFailed(res, [{ field: 'body', message: 'body must be an object' }]);
  }

  const errors = Object.keys(body)
    .filter((field) => !allowedFields.has(field))
    .map((field) => ({ field, message: `${field} is not allowed` }));

  rejectUnknownNestedFields(body, 'taxSettings', TAX_SETTINGS_FIELDS, errors);
  rejectUnknownNestedFields(body, 'address', ADDRESS_FIELDS, errors);
  rejectUnknownNestedFields(body, 'billingPreferences', BILLING_PREFERENCES_FIELDS, errors);

  if (errors.length) return validationFailed(res, errors);
  next();
};

export const requireFirmBodyFields = (allowedFields = FIRM_WRITE_FIELDS) => (req, res, next) => {
  const body = req.body || {};
  const hasField = allowedFields === TAX_SETTINGS_FIELDS ||
    allowedFields === BILLING_PREFERENCES_FIELDS ||
    allowedFields === ADDRESS_FIELDS
    ? hasAllowedNestedField(body, allowedFields)
    : hasAllowedField(body, allowedFields);

  if (!hasField) {
    return validationFailed(res, [{ field: 'body', message: 'At least one field is required' }]);
  }

  next();
};

export const normalizeFirmPayload = (req, _res, next) => {
  const body = req.body || {};

  trimString(body, 'name');
  trimString(body, 'currency');
  if (body.currency) body.currency = body.currency.toUpperCase();
  trimString(body, 'taxName');
  numberFromInput(body, 'taxRatePct');
  booleanFromInput(body, 'inclusive');
  numberFromInput(body, 'defaultRate');
  booleanFromInput(body, 'autoSync');

  if (isPlainObject(body.taxSettings)) {
    trimString(body.taxSettings, 'taxName');
    numberFromInput(body.taxSettings, 'taxRatePct');
    booleanFromInput(body.taxSettings, 'inclusive');
  }

  if (isPlainObject(body.address)) {
    for (const field of ADDRESS_FIELDS) trimString(body.address, field);
    if (body.address.country) body.address.country = body.address.country.toUpperCase();
  }

  if (isPlainObject(body.billingPreferences)) {
    numberFromInput(body.billingPreferences, 'defaultRate');
    booleanFromInput(body.billingPreferences, 'autoSync');
  }

  next();
};

export const validateFirmNestedPayload = (req, res, next) => {
  const body = req.body || {};
  const errors = [];
  validateNestedValues(body, errors);
  if (errors.length) return validationFailed(res, errors);
  next();
};

export const validateFirmIdParam = validateParams({
  firmId: [required, objectId()],
});

export const validateCreateFirm = validateBody({
  name: [required, string({ min: 1, max: 180 })],
  currency: [string({ min: 3, max: 3 })],
});

export const validateUpdateFirm = validateBody({
  name: [string({ min: 1, max: 180 })],
  currency: [string({ min: 3, max: 3 })],
});

export const validateCurrency = validateBody({
  currency: [required, string({ min: 3, max: 3 })],
});

export const validateTaxSettings = validateBody({
  taxName: [string({ max: 80 })],
  taxRatePct: [number({ min: 0, max: 100 })],
  inclusive: [boolean()],
});

export const validateBillingPreferences = validateBody({
  defaultRate: [number({ min: 0 })],
  autoSync: [boolean()],
});
