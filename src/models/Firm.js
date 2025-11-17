// src/models/Firm.js

import mongoose from 'mongoose';

const TaxSettingsSchema = new mongoose.Schema(
  {
    taxName: { type: String, default: 'GST' },
    taxRatePct: { type: Number, default: 0 },
    inclusive: { type: Boolean, default: false },
  },
  { _id: false }
);

const AddressSchema = new mongoose.Schema(
  {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: { type: String, default: 'IN' },
  },
  { _id: false }
);

const FirmSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    currency: { type: String, default: 'INR' },
    taxSettings: { type: TaxSettingsSchema, default: () => ({}) },
    address: { type: AddressSchema },
    billingPreferences: {
      defaultRate: { type: Number },
      autoSync: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

FirmSchema.index({ name: 1 });

export const Firm = mongoose.model('Firm', FirmSchema);