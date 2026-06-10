import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { DocumentStorageController } from '../controllers/documentStorageController.js';
import {
  validateCreateDocument,
  validateDocumentId,
  validateDocumentStatus,
  validateListDocuments,
  validateUpdateDocument,
} from '../validators/documentStorageValidators.js';

const router = Router();

router.use(authenticate);

router.get('/', validateListDocuments, DocumentStorageController.list);
router.post('/', validateCreateDocument, DocumentStorageController.create);
router.get('/:documentId', validateDocumentId, DocumentStorageController.getById);
router.patch('/:documentId', validateDocumentId, validateUpdateDocument, DocumentStorageController.update);
router.post('/:documentId/status', validateDocumentId, validateDocumentStatus, DocumentStorageController.setStatus);

export default router;
