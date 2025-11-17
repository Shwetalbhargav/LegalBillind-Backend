// src/models/Invoice.js

import mongoose from 'mongoose';

const InvoiceSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },

    periodStart: { type: Date },
    periodEnd: { type: Date },

    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date },

    currency: { type: String, default: 'INR' },

    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },

    status: { type: String, enum: ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'], default: 'draft', index: true },
    pdfUrl: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    items: [
      { 
        billableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Billable', index: true  },
         description: String, durationMinutes: Number, rate: Number, amount: Number },
    ],
  },
  { timestamps: true }
);

InvoiceSchema.pre('validate', function(next) {
  const items = this.items || [];
  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0);
  this.subtotal = Math.round(subtotal * 100) / 100;
  const tax = this.tax || 0;
  this.total = Math.round((this.subtotal + tax) * 100) / 100;
  next();
  });

InvoiceSchema.methods.computeStatus = function (paidAmount = 0) {
  if (this.status === 'void') return 'void';
  const total = this.total || 0;
  const now = new Date();
  if (paidAmount >= total) return 'paid';
  if (paidAmount > 0) return 'partial';
  if (this.dueDate && this.dueDate < now) return 'overdue';
  return this.status === 'draft' ? 'draft' : 'sent';
};

InvoiceSchema.index({ clientId: 1, status: 1, issueDate: 1 });
InvoiceSchema.index({ caseId: 1, status: 1 });

export const Invoice = mongoose.model('Invoice', InvoiceSchema);