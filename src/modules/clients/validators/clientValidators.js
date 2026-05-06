import { objectId, required, string, validateBody } from '../../../middleware/validate.js';

export const validateCreateClient = validateBody({
  displayName: [required, string({ min: 1, max: 160 })],
  email: [string({ max: 254 })],
  phone: [string({ max: 40 })],
  firmId: [objectId()],
  ownerUserId: [objectId()],
  paymentTerms: [string({ max: 40 })],
});

export const validateUpdateClient = validateBody({
  displayName: [string({ min: 1, max: 160 })],
  email: [string({ max: 254 })],
  phone: [string({ max: 40 })],
  firmId: [objectId()],
  ownerUserId: [objectId()],
  paymentTerms: [string({ max: 40 })],
});

export const validateAssignOwner = validateBody({
  ownerUserId: [objectId()],
  paymentTerms: [string({ max: 40 })],
});
