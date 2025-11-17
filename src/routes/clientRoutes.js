// src/routes/clientRoutes.js
import { Router } from 'express';
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

// CRUD
router.get('/clients', getAllClients);
router.get('/clients/:clientId', getClientById);
router.post('/clients', createClient);
router.put('/clients/:clientId', updateClient);
router.delete('/clients/:clientId', deleteClient);

// Owner mapping + payment terms
router.patch('/clients/:clientId/assign-owner', assignOwner);

// Related lists
router.get('/clients/:clientId/cases', listClientCases);
router.get('/clients/:clientId/invoices', listClientInvoices);
router.get('/clients/:clientId/payments', listClientPayments);

// Financial summary
router.get('/clients/:clientId/summary', clientSummary);

export default router;
