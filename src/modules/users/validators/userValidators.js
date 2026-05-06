import { objectId, oneOf, required, string, validateBody } from '../../../middleware/validate.js';

const roles = ['partner', 'lawyer', 'associate', 'intern', 'admin'];

export const validateCreateUser = validateBody({
  name: [required, string({ min: 1, max: 120 })],
  email: [required, string({ min: 1, max: 254 })],
  role: [required, oneOf(roles)],
  mobile: [required, string({ min: 6, max: 30 })],
  password: [required, string({ min: 1 })],
  firmId: [objectId()],
});

export const validateUpdateUser = validateBody({
  name: [string({ min: 1, max: 120 })],
  email: [string({ min: 1, max: 254 })],
  role: [oneOf(roles)],
  mobile: [string({ min: 6, max: 30 })],
  password: [string({ min: 1 })],
  firmId: [objectId()],
});
