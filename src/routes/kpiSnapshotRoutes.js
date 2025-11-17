// src/routes/kpiSnapshotRoutes.js
import { Router } from 'express';
import {
  generateSnapshots,
  listSnapshots,
  getSnapshotById,
} from '../controllers/kpiSnapshotController.js';

const router = Router();

/**
 * Examples:
 *  POST /api/kpi-snapshots/generate  { "month": "2025-09", "scopes": ["firm","client"], "scopeIds": ["<clientId1>","<clientId2>"] }
 *  GET  /api/kpi-snapshots?month=2025-09&scope=client&scopeId=<clientId>
 *  GET  /api/kpi-snapshots/<id>
 */
router.post('/generate', generateSnapshots);
router.get('/', listSnapshots);
router.get('/:id', getSnapshotById);

export default router;
