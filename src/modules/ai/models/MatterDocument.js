import mongoose from 'mongoose';

const MatterDocumentSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    documentType: {
      type: String,
      enum: ['note', 'brief', 'draft', 'order', 'evidence', 'correspondence', 'research', 'other'],
      default: 'other',
      index: true,
    },
    content: { type: String, required: true, maxlength: 50000 },
    summary: { type: String, maxlength: 2000 },
    tags: [{ type: String, trim: true, maxlength: 80 }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

MatterDocumentSchema.index({ caseId: 1, createdAt: -1 });
MatterDocumentSchema.index({ title: 'text', content: 'text', summary: 'text', tags: 'text' });

export const MatterDocument = mongoose.model('MatterDocument', MatterDocumentSchema);
export default MatterDocument;
