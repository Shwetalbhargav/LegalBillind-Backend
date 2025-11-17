// src/routes/firmRoutes.js
import { Router } from 'express';
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

// CRUD
router.post('/firms', createFirm);
router.get('/firms', listFirms);
router.get('/firms/:firmId', getFirmById);
router.put('/firms/:firmId', updateFirm);
router.delete('/firms/:firmId', deleteFirm);

// Settings (currency, taxes, billing prefs)
router.get('/firms/:firmId/settings', getFirmSettings);
router.patch('/firms/:firmId/currency', updateCurrency);
router.patch('/firms/:firmId/tax-settings', updateTaxSettings);
router.patch('/firms/:firmId/billing-preferences', updateBillingPreferences);

export default router;
