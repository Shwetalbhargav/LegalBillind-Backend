// src/routes/invoiceLineRoutes.js

import { Router } from 'express';
import { listLines, addLine, updateLine, deleteLine } from '../controllers/invoiceLineController.js';

const router = Router({ mergeParams: true });

// nested under /api/invoices/:invoiceId/lines
router.get('/', listLines);
router.post('/', addLine);
router.put('/:lineId', updateLine);
router.delete('/:lineId', deleteLine);

export default router;