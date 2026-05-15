// src/models/Client.js 

import mongoose from 'mongoose';

export const CLIENT_STATUSES = ['active', 'inactive', 'prospect'];
export const PAYMENT_TERMS = [
  'DUE_ON_RECEIPT',
  'NET7',
  'NET15',
  'NET30',
  'NET45',
  'NET60',
  'NET90',
];

const ClientContactSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    role: String,
    integrations: {
      zoho: {
        crmRecordId: { type: String },
        lastSyncedAt: { type: Date },
      },
    },
  },
  { _id: false }
);

const ClientSchema = new mongoose.Schema(
  {
    displayName: { type: String, required: true, trim: true },
    name: { type: String, trim: true }, // deprecated
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    contactInfo: { type: String },

    firmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm' },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: CLIENT_STATUSES, default: 'active', index: true },
    paymentTerms: { type: String, enum: PAYMENT_TERMS, default: 'NET30', trim: true, uppercase: true },
    contacts: { type: [ClientContactSchema], default: [] },
    integrations: {
      zoho: {
        crmModule: { type: String, default: 'Accounts' },
        crmRecordId: { type: String },
        lastSyncedAt: { type: Date },
      },
    },
  },
  { timestamps: true }
);

ClientSchema.index({ displayName: 'text', email: 1, phone: 1 });

export const Client = mongoose.model('Client', ClientSchema);
export default Client;
