import mongoose from 'mongoose';

const InvoiceSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },

  items: [{
    billableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Billable', required: true },
    description: { type: String },
    durationMinutes: { type: Number },
    rate: { type: Number },
    amount: { type: Number }
  }],

  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },

  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  status: { type: String, enum: ['draft', 'sent', 'paid', 'overdue'], default: 'draft' },

  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

const Invoice = mongoose.model('Invoice', InvoiceSchema);
export default Invoice;
