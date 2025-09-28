import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema(
  {
    amount:    { type: Number, required: true, min: 0 },
    date:      { type: Date,   required: true }, // date of payment
    method:    {
      type: String,
      enum: ['bank_transfer', 'cheque', 'cash', 'card', 'upi', 'wallet', 'other'],
      required: true
    },
    reference: { type: String, trim: true },     // txn id / cheque no / UTR
    receivedBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes:     { type: String, trim: true }
  },
  { _id: false }
);

const InvoiceSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    caseId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },

    items: [{
      billableId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Billable', required: true },
      description:      { type: String },
      durationMinutes:  { type: Number },
      rate:             { type: Number },
      amount:           { type: Number }
    }],

    // Financials
    subtotal:     { type: Number, default: 0 },
    taxAmount:    { type: Number, default: 0 },
    totalAmount:  { type: Number, required: true }, // subtotal + tax - discounts
    amountPaid:   { type: Number, default: 0, min: 0 }, // maintained from payments[]
    payments:     { type: [PaymentSchema], default: [] },
    currency:     { type: String, default: 'INR' },

    // Dates
    issueDate: { type: Date, default: Date.now },
    dueDate:   { type: Date },

    // Lifecycle
    status: {
      type: String,
      enum: ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'],
      default: 'draft',
      index: true
    },

    notes:     { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

// Virtuals
InvoiceSchema.virtual('balance').get(function () {
  const paid = this.amountPaid || 0;
  return Math.max(0, (this.totalAmount || 0) - paid);
});
InvoiceSchema.set('toJSON', { virtuals: true });
InvoiceSchema.set('toObject', { virtuals: true });

// Keep amountPaid and status in sync with payments / due date
InvoiceSchema.pre('save', function (next) {
  // sync amountPaid
  if (Array.isArray(this.payments)) {
    this.amountPaid = this.payments.reduce((s, p) => s + (p.amount || 0), 0);
  }

  // auto-status (except 'void')
  if (this.status !== 'void') {
    const total = this.totalAmount || 0;
    const now   = new Date();

    if (this.amountPaid >= total)       this.status = 'paid';
    else if (this.amountPaid > 0)       this.status = 'partial';
    else if (this.dueDate && this.dueDate < now) this.status = 'overdue';
    else if (this.status === 'draft')   this.status = 'draft';
    else                                this.status = 'sent';
  }
  next();
});

// Helpful indexes
InvoiceSchema.index({ clientId: 1, status: 1, issueDate: 1 });
InvoiceSchema.index({ caseId: 1, status: 1 });

const Invoice = mongoose.model('Invoice', InvoiceSchema);
export default Invoice;
