import mongoose from 'mongoose';

const AuditEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, maxlength: 80 },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: 500 },
    changes: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const StoredDocumentSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    documentType: {
      type: String,
      enum: ['pleading', 'contract', 'evidence', 'correspondence', 'invoice', 'research', 'note', 'other'],
      default: 'other',
      index: true,
    },
    provider: {
      type: String,
      enum: ['local', 'zoho_workdrive', 'google_drive', 'onedrive', 's3', 'external'],
      default: 'local',
      index: true,
    },
    storageKey: { type: String, required: true, trim: true, maxlength: 1000 },
    originalFileName: { type: String, trim: true, maxlength: 300 },
    mimeType: { type: String, trim: true, maxlength: 160 },
    sizeBytes: { type: Number, min: 0 },
    checksumSha256: { type: String, trim: true, maxlength: 64 },
    externalUrl: { type: String, trim: true, maxlength: 2048 },
    status: {
      type: String,
      enum: ['stored', 'linked', 'archived', 'deleted'],
      default: 'stored',
      index: true,
    },
    tags: [{ type: String, trim: true, maxlength: 80 }],
    description: { type: String, trim: true, maxlength: 2000 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lastAccessedAt: { type: Date },
    archivedAt: { type: Date },
    deletedAt: { type: Date },
    auditTrail: { type: [AuditEntrySchema], default: [] },
  },
  { timestamps: true }
);

StoredDocumentSchema.index({ caseId: 1, createdAt: -1 });
StoredDocumentSchema.index({ clientId: 1, status: 1, createdAt: -1 });
StoredDocumentSchema.index({ provider: 1, storageKey: 1 }, { unique: true });
StoredDocumentSchema.index({ title: 'text', originalFileName: 'text', description: 'text', tags: 'text' });

export const StoredDocument = mongoose.model('StoredDocument', StoredDocumentSchema);
export default StoredDocument;
