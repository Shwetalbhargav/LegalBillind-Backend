// src/models/Case.js

import mongoose from 'mongoose';

const CaseSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    title: { type: String, required: true, trim: true },
    name: { type: String }, // deprecated
    description: { type: String },

    status: { type: String, enum: ['open', 'closed', 'pending', 'archived'], default: 'open', index: true },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },

    leadPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    managingLawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    primaryLawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    billingType: { type: String, enum: ['hourly', 'fixed_fee', 'contingency', 'retainer'], default: 'hourly' },

    case_type: { type: String, trim: true },
    case_type_id: { type: mongoose.Schema.Types.ObjectId, index: true },
  },
  { timestamps: true }
);

CaseSchema.index({ clientId: 1, status: 1 });
CaseSchema.index({ title: 'text', description: 'text' });

export const Case = mongoose.model('Case', CaseSchema);