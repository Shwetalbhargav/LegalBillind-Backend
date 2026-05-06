import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { listLines, addLine, updateLine, deleteLine } from '../controllers/invoiceLineController.js';
import { validateInvoiceLine } from '../validators/invoiceValidators.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

// nested under /api/invoices/:invoiceId/lines
router.get('/', listLines);
router.post('/', validateInvoiceLine, addLine);
router.put('/:lineId', validateInvoiceLine, updateLine);
router.delete('/:lineId', deleteLine);

export default router;
