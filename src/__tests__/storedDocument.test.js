import { describe, expect, test } from 'vitest';
import mongoose from 'mongoose';
import { StoredDocument } from '../modules/documentStorage/models/StoredDocument.js';

describe('StoredDocument', () => {
  test('validates explicit document storage metadata and audit trail', async () => {
    const id = new mongoose.Types.ObjectId();
    const doc = new StoredDocument({
      caseId: id,
      clientId: new mongoose.Types.ObjectId(),
      title: 'Signed Vakalatnama',
      documentType: 'evidence',
      provider: 'zoho_workdrive',
      storageKey: 'workdrive/folders/abc/files/vakalatnama.pdf',
      originalFileName: 'vakalatnama.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 24000,
      checksumSha256: 'a'.repeat(64),
      status: 'linked',
      uploadedBy: new mongoose.Types.ObjectId(),
      auditTrail: [{ action: 'created', changes: { provider: 'zoho_workdrive' } }],
    });

    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.provider).toBe('zoho_workdrive');
    expect(doc.auditTrail[0].action).toBe('created');
  });

  test('rejects unsupported providers', async () => {
    const doc = new StoredDocument({
      caseId: new mongoose.Types.ObjectId(),
      clientId: new mongoose.Types.ObjectId(),
      title: 'Unsupported',
      provider: 'random_drive',
      storageKey: 'x',
      uploadedBy: new mongoose.Types.ObjectId(),
    });

    await expect(doc.validate()).rejects.toThrow(/random_drive/);
  });
});
