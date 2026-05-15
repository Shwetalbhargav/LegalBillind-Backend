import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  assignOwnerFields,
  clientWriteFields,
  normalizeClientPayload,
  rejectUnknownClientFields,
  requireClientBodyFields,
  validateAssignOwner,
  validateClientIdParam,
  validateCreateClient,
  validateListClientsQuery,
  validateRelatedClientQuery,
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
router.get('/', validateListClientsQuery, getAllClients);
router.post(
  '/',
  rejectUnknownClientFields(clientWriteFields),
  normalizeClientPayload,
  validateCreateClient,
  createClient
);
router.get('/:clientId', validateClientIdParam, getClientById);
router.put(
  '/:clientId',
  validateClientIdParam,
  rejectUnknownClientFields(clientWriteFields),
  normalizeClientPayload,
  requireClientBodyFields(clientWriteFields),
  validateUpdateClient,
  updateClient
);
router.delete('/:clientId', validateClientIdParam, deleteClient);

// Owner mapping + payment terms
router.patch(
  '/:clientId/assign-owner',
  validateClientIdParam,
  rejectUnknownClientFields(assignOwnerFields),
  normalizeClientPayload,
  requireClientBodyFields(assignOwnerFields),
  validateAssignOwner,
  assignOwner
);

// Related lists
router.get('/:clientId/cases', validateClientIdParam, validateRelatedClientQuery, listClientCases);
router.get('/:clientId/invoices', validateClientIdParam, validateRelatedClientQuery, listClientInvoices);
router.get('/:clientId/payments', validateClientIdParam, validateRelatedClientQuery, listClientPayments);

// Financial summary
router.get('/:clientId/summary', validateClientIdParam, clientSummary);

export default router;
