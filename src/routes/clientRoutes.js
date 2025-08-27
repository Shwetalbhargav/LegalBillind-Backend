import express from 'express';
import {
  getAllClients,
  getClientDashboard,
  createClient,
  updateClient,
  deleteClient
} from '../controllers/clientController.js';

const router = express.Router();

// Create + Read
router.get('/', getAllClients);
router.post('/create', createClient);

// Dashboard View
router.get('/:clientId/dashboard', getClientDashboard);

// Update + Delete (custom path names)
router.put('/:clientId/update', updateClient);
router.delete('/:clientId/delete', deleteClient);

export default router;
