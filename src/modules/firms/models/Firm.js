// src/models/Firm.js

import mongoose from 'mongoose';

const TaxSettingsSchema = new mongoose.Schema(
  {
    taxName: { type: String, default: 'GST', trim: true, maxlength: 80 },
    taxRatePct: { type: Number, default: 0, min: 0, max: 100 },
    inclusive: { type: Boolean, default: false },
  },
  { _id: false }
);

const AddressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, maxlength: 180 },
    line2: { type: String, trim: true, maxlength: 180 },
    city: { type: String, trim: true, maxlength: 180 },
    state: { type: String, trim: true, maxlength: 180 },
    postalCode: { type: String, trim: true, maxlength: 180 },
    country: { type: String, trim: true, uppercase: true, default: 'IN', maxlength: 180 },
  },
  { _id: false }
);

const FirmSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    currency: { type: String, trim: true, uppercase: true, minlength: 3, maxlength: 3, default: 'INR' },
    taxSettings: { type: TaxSettingsSchema, default: () => ({}) },
    address: { type: AddressSchema },
    billingPreferences: {
      defaultRate: { type: Number, min: 0 },
      autoSync: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

FirmSchema.index({ name: 1 });

export const Firm = mongoose.model('Firm', FirmSchema);
export default Firm;
