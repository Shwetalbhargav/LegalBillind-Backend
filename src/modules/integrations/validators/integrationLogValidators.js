import { date, objectId, oneOf, required, validateBody } from '../../../middleware/validate.js';

export const validateCreateIntegrationLog = validateBody({
  platform: [required, oneOf(['Zoho', 'PracticePanther', 'MyCase'])],
  status: [required, oneOf(['pending', 'success', 'failed'])],
  billableId: [objectId()],
  invoiceId: [objectId()],
});

export const validatePurgeIntegrationLogs = validateBody({
  platform: [oneOf(['Zoho', 'PracticePanther', 'MyCase'])],
  status: [oneOf(['pending', 'success', 'failed'])],
  before: [date()],
});
