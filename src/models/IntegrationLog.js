import mongoose from 'mongoose';

const IntegrationLogSchema = new mongoose.Schema({
  billableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Billable', required: true },
  platform: { type: String, enum: ['Clio', 'PracticePanther', 'MyCase'], required: true },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  billableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Billable', required: false },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  response: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

const IntegrationLog = mongoose.model('IntegrationLog', IntegrationLogSchema);
export default IntegrationLog;
