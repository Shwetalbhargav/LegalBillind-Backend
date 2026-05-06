import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  validateBillingPreferences,
  validateCreateFirm,
  validateCurrency,
  validateTaxSettings,
  validateUpdateFirm,
} from '../validators/firmValidators.js';
import {
  createFirm,
  listFirms,
  getFirmById,
  updateFirm,
  deleteFirm,
  getFirmSettings,
  updateCurrency,
  updateTaxSettings,
  updateBillingPreferences,
} from '../controllers/firmController.js';

const router = Router();

router.use(authenticate);

// CRUD
router.post('/', authorize('admin', 'partner'), validateCreateFirm, createFirm);
router.get('/', listFirms);
router.get('/:firmId', getFirmById);
router.put('/:firmId', authorize('admin', 'partner'), validateUpdateFirm, updateFirm);
router.delete('/:firmId', authorize('admin'), deleteFirm);

// Settings (currency, taxes, billing prefs)
router.get('/:firmId/settings', getFirmSettings);
router.patch('/:firmId/currency', authorize('admin', 'partner'), validateCurrency, updateCurrency);
router.patch('/:firmId/tax-settings', authorize('admin', 'partner'), validateTaxSettings, updateTaxSettings);
router.patch('/:firmId/billing-preferences', authorize('admin', 'partner'), validateBillingPreferences, updateBillingPreferences);

export default router;
