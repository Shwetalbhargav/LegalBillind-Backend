// src/models/Activity.js

import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    activityType: { type: String, enum: ['email', 'drafting', 'review', 'meeting', 'hearing', 'research', 'call', 'other'], required: true },
    startedAt: { type: Date },
    endedAt: { type: Date },
    durationMinutes: { type: Number, min: 0 },

    source: { type: String, enum: ['gmail', 'extension', 'manual', 'integration', 'system'], default: 'extension' },
    sourceRef: { type: String },

    narrative: { type: String },
    activityCode: { type: String },
  },
  { timestamps: true }
);

ActivitySchema.index({ caseId: 1, userId: 1, createdAt: -1 });

export const Activity = mongoose.model('Activity', ActivitySchema);
