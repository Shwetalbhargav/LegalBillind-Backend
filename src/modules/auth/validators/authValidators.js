import { array, matches, objectId, oneOf, required, string, validateBody } from '../../../middleware/validate.js';

const roles = ['partner', 'lawyer', 'associate', 'intern', 'admin'];
const registerRoles = roles.filter((role) => role !== 'admin');
const currentYear = new Date().getFullYear();

const qualification = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'must be an object';

  for (const key of ['degree', 'university']) {
    if (value[key] !== undefined && value[key] !== null && typeof value[key] !== 'string') {
      return `${key} must be a string`;
    }
    if (typeof value[key] === 'string' && value[key].trim().length > 120) {
      return `${key} must be at most 120 characters`;
    }
  }

  if (value.year !== undefined && value.year !== null) {
    if (typeof value.year !== 'number' || !Number.isInteger(value.year)) return 'year must be an integer';
    if (value.year < 1900 || value.year > currentYear + 10) return `year must be between 1900 and ${currentYear + 10}`;
  }

  return null;
};

export const validateLogin = validateBody({
  name: [required, string({ min: 1, max: 120 })],
  mobile: [required, string({ min: 10, max: 10 }), matches(/^\d{10}$/, "a 10-digit mobile number")],
  password: [required, string({ min: 1, max: 128 })],
  role: [required, oneOf(roles)],
  firmId: [required, objectId()],
});

export const validateRegister = validateBody({
  name: [required, string({ min: 1, max: 120 }), matches(/^[A-Za-z .'-]+$/, "letters, spaces, apostrophes, periods, or hyphens only")],
  mobile: [required, string({ min: 10, max: 10 }), matches(/^\d{10}$/, "a 10-digit mobile number")],
  password: [required, string({ min: 8, max: 128 })],
  role: [required, oneOf(registerRoles)],
  email: [required, string({ max: 254 }), matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "a valid email address")],
  firmId: [required, objectId()],
  firmName: [string({ min: 1, max: 180 })],
  address: [string({ max: 500 })],
  qualifications: [array({ item: qualification })],
});
