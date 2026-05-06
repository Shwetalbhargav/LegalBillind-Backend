import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  validateAssignOwner,
  validateCreateClient,
  validateUpdateClient,
} from '../validators/clientValidators.js';
import {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  assignOwner,
  listClientCases,
  listClientInvoices,
  listClientPayments,
  clientSummary,
} from '../controllers/clientController.js';

const router = Router();

router.use(authenticate);

// CRUD
router.get('/', getAllClients);
router.post('/', validateCreateClient, createClient);
router.get('/:clientId', getClientById);
router.put('/:clientId', validateUpdateClient, updateClient);
router.delete('/:clientId', deleteClient);

// Owner mapping + payment terms
router.patch('/:clientId/assign-owner', validateAssignOwner, assignOwner);

// Related lists
router.get('/:clientId/cases', listClientCases);
router.get('/:clientId/invoices', listClientInvoices);
router.get('/:clientId/payments', listClientPayments);

// Financial summary
router.get('/:clientId/summary', clientSummary);

export default router;
