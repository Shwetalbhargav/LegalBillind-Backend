import { array, matches, objectId, oneOf, required, validateBody } from '../../../middleware/validate.js';

const scopes = ['firm', 'user', 'client', 'case'];
const month = matches(/^\d{4}-\d{2}$/, 'YYYY-MM');

export const validateGenerateSnapshots = validateBody({
  month: [month],
  scopes: [array({ item: oneOf(scopes) })],
  scopeIds: [array({ item: objectId() })],
});

export const validateComputeAndUpsert = validateBody({
  scope: [required, oneOf(scopes)],
  scopeId: [objectId()],
  month: [month],
});
