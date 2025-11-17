// src/models/KpiSnapshot.js

import mongoose from 'mongoose';

const KpiSnapshotSchema = new mongoose.Schema(
  {
    scope: { type: String, enum: ['firm', 'user', 'client', 'case'], required: true },
    scopeId: { type: mongoose.Schema.Types.ObjectId },
    month: { type: String, required: true }, // YYYY-MM

    utilization: { type: Number, default: 0 },
    realization: { type: Number, default: 0 },
    WIP: { type: Number, default: 0 },
    AR: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

KpiSnapshotSchema.index({ scope: 1, scopeId: 1, month: 1 }, { unique: true, partialFilterExpression: { scopeId: { $exists: true } } });
KpiSnapshotSchema.index({ scope: 1, month: 1 });

export const KpiSnapshot = mongoose.model('KpiSnapshot', KpiSnapshotSchema);