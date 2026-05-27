import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  BILLING_PREFERENCES_FIELDS,
  CURRENCY_FIELDS,
  FIRM_WRITE_FIELDS,
  TAX_SETTINGS_FIELDS,
  normalizeFirmPayload,
  rejectUnknownFirmFields,
  requireFirmBodyFields,
  validateBillingPreferences,
  validateCreateFirm,
  validateCurrency,
  validateFirmIdParam,
  validateFirmNestedPayload,
  validateTaxSettings,
  validateUpdateFirm,
} from '../validators/firmValidators.js';
import {
  createFirm,
  listFirms,
  listFirmOptions,
  getFirmById,
  updateFirm,
  deleteFirm,
  getFirmSettings,
  updateCurrency,
  updateTaxSettings,
  updateBillingPreferences,
} from '../controllers/firmController.js';

const router = Router();

router.get('/options', listFirmOptions);

router.use(authenticate);

// CRUD
router.post(
  '/',
  authorize('admin', 'partner'),
  rejectUnknownFirmFields(FIRM_WRITE_FIELDS),
  normalizeFirmPayload,
  validateFirmNestedPayload,
  validateCreateFirm,
  createFirm
);
router.get('/', listFirms);
router.get('/:firmId', validateFirmIdParam, getFirmById);
router.put(
  '/:firmId',
  validateFirmIdParam,
  authorize('admin', 'partner'),
  rejectUnknownFirmFields(FIRM_WRITE_FIELDS),
  normalizeFirmPayload,
  requireFirmBodyFields(FIRM_WRITE_FIELDS),
  validateFirmNestedPayload,
  validateUpdateFirm,
  updateFirm
);
router.delete('/:firmId', validateFirmIdParam, authorize('admin'), deleteFirm);

// Settings (currency, taxes, billing prefs)
router.get('/:firmId/settings', validateFirmIdParam, getFirmSettings);
router.patch(
  '/:firmId/currency',
  validateFirmIdParam,
  authorize('admin', 'partner'),
  rejectUnknownFirmFields(CURRENCY_FIELDS),
  normalizeFirmPayload,
  requireFirmBodyFields(CURRENCY_FIELDS),
  validateCurrency,
  updateCurrency
);
router.patch(
  '/:firmId/tax-settings',
  validateFirmIdParam,
  authorize('admin', 'partner'),
  rejectUnknownFirmFields(TAX_SETTINGS_FIELDS),
  normalizeFirmPayload,
  requireFirmBodyFields(TAX_SETTINGS_FIELDS),
  validateTaxSettings,
  updateTaxSettings
);
router.patch(
  '/:firmId/billing-preferences',
  validateFirmIdParam,
  authorize('admin', 'partner'),
  rejectUnknownFirmFields(BILLING_PREFERENCES_FIELDS),
  normalizeFirmPayload,
  requireFirmBodyFields(BILLING_PREFERENCES_FIELDS),
  validateBillingPreferences,
  updateBillingPreferences
);

export default router;
