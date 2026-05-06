import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  validateComputeAndUpsert,
  validateGenerateSnapshots,
} from '../validators/kpiSnapshotValidators.js';
import {
  generateSnapshots,
  listSnapshots,
  getSnapshotById,
  computeAndUpsert
} from '../controllers/kpiSnapshotController.js';

const router = Router();

router.use(authenticate);

/**
 * Examples:
 *  POST /api/kpi-snapshots/generate  { "month": "2025-09", "scopes": ["firm","client"], "scopeIds": ["<clientId1>","<clientId2>"] }
 *  GET  /api/kpi-snapshots?month=2025-09&scope=client&scopeId=<clientId>
 *  GET  /api/kpi-snapshots/<id>
 */
router.post('/generate', validateGenerateSnapshots, generateSnapshots);
router.get('/', listSnapshots);
router.post('/compute-upsert', validateComputeAndUpsert, computeAndUpsert);
router.get('/:id', getSnapshotById);

export default router;
