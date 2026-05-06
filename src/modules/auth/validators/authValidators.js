import { objectId, oneOf, required, string, validateBody } from '../../../middleware/validate.js';

const roles = ['partner', 'lawyer', 'associate', 'intern', 'admin'];

export const validateLogin = validateBody({
  name: [required, string({ min: 1, max: 120 })],
  mobile: [required, string({ min: 6, max: 30 })],
  password: [required, string({ min: 1 })],
  role: [required, oneOf(roles)],
});

export const validateRegister = validateBody({
  name: [required, string({ min: 1, max: 120 })],
  mobile: [required, string({ min: 6, max: 30 })],
  password: [required, string({ min: 1 })],
  role: [required, oneOf(roles)],
  email: [string({ max: 254 })],
  firmId: [objectId()],
});
