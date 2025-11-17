// src/models/Client.js 

import mongoose from 'mongoose';

const ClientContactSchema = new mongoose.Schema(
  { name: String, email: String, phone: String, role: String },
  { _id: false }
);

const ClientSchema = new mongoose.Schema(
  {
    displayName: { type: String, required: true, trim: true },
    name: { type: String }, // deprecated
    email: { type: String },
    phone: { type: String },
    contactInfo: { type: String },

    firmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm' },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['active', 'inactive', 'prospect'], default: 'active', index: true },
    paymentTerms: { type: String, default: 'NET30' },
    contacts: { type: [ClientContactSchema], default: [] },
  },
  { timestamps: true }
);

ClientSchema.index({ displayName: 'text', email: 1, phone: 1 });

export const Client = mongoose.model('Client', ClientSchema);