// src/models/InvoiceLine.js

import mongoose from 'mongoose';

const InvoiceLineSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    timeEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'TimeEntry' },
    description: { type: String, required: true },
    qtyHours: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

InvoiceLineSchema.index({ invoiceId: 1 });

export const InvoiceLine = mongoose.model('InvoiceLine', InvoiceLineSchema);