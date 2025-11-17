// src/models/Payment.js

import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['bank_transfer', 'cheque', 'cash', 'card', 'upi', 'wallet', 'other'], required: true },
    receivedDate: { type: Date, required: true },
    reference: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'cleared', 'failed'], default: 'cleared' },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

PaymentSchema.index({ invoiceId: 1, receivedDate: -1 });

export const Payment = mongoose.model('Payment', PaymentSchema);