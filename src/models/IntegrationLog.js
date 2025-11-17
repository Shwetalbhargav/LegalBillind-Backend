// /models/IntegrationLog.js
import mongoose from 'mongoose';

const IntegrationLogSchema = new mongoose.Schema(
  {
    billableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Billable' }, 
    invoiceId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },

    platform: { type: String, enum: ['Clio', 'PracticePanther', 'MyCase'], required: true },
    status:   { type: String, enum: ['pending', 'success', 'failed'], default: 'pending', index: true },

    request:  { type: mongoose.Schema.Types.Mixed }, 
    response: { type: mongoose.Schema.Types.Mixed },
    error:    { type: mongoose.Schema.Types.Mixed }  
  },
  { timestamps: true }
);

// Helpful indexes for troubleshooting streams
IntegrationLogSchema.index({ platform: 1, createdAt: -1 });
IntegrationLogSchema.index({ billableId: 1, createdAt: -1 });
IntegrationLogSchema.index({ invoiceId: 1, createdAt: -1 });

const IntegrationLog = mongoose.model('IntegrationLog', IntegrationLogSchema);
export default IntegrationLog;
