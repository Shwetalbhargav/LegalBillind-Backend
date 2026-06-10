import { date, number, objectId, oneOf, required, string, validateBody, validateParams, validateQuery } from '../../../middleware/validate.js';

const documentTypes = ['pleading', 'contract', 'evidence', 'correspondence', 'invoice', 'research', 'note', 'other'];
const providers = ['local', 'zoho_workdrive', 'google_drive', 'onedrive', 's3', 'external'];
const statuses = ['stored', 'linked', 'archived', 'deleted'];

export const validateDocumentId = validateParams({
  documentId: [required, objectId()],
});

export const validateListDocuments = validateQuery({
  caseId: [objectId()],
  clientId: [objectId()],
  provider: [oneOf(providers)],
  status: [oneOf(statuses)],
  documentType: [oneOf(documentTypes)],
  uploadedBy: [objectId()],
  from: [date()],
  to: [date()],
});

export const validateCreateDocument = validateBody({
  title: [required, string({ min: 1, max: 240 })],
  caseId: [required, objectId()],
  clientId: [required, objectId()],
  documentType: [oneOf(documentTypes)],
  provider: [oneOf(providers)],
  storageKey: [required, string({ min: 1, max: 1000 })],
  originalFileName: [string({ max: 300 })],
  mimeType: [string({ max: 160 })],
  sizeBytes: [number({ min: 0 })],
  checksumSha256: [string({ max: 64 })],
  externalUrl: [string({ max: 2048 })],
  description: [string({ max: 2000 })],
});

export const validateUpdateDocument = validateBody({
  title: [string({ min: 1, max: 240 })],
  documentType: [oneOf(documentTypes)],
  provider: [oneOf(providers)],
  storageKey: [string({ min: 1, max: 1000 })],
  originalFileName: [string({ max: 300 })],
  mimeType: [string({ max: 160 })],
  sizeBytes: [number({ min: 0 })],
  checksumSha256: [string({ max: 64 })],
  externalUrl: [string({ max: 2048 })],
  status: [oneOf(statuses)],
  description: [string({ max: 2000 })],
});

export const validateDocumentStatus = validateBody({
  status: [required, oneOf(statuses)],
  note: [string({ max: 500 })],
});
