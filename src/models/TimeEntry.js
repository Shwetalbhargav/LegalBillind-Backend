// src/models/TimeEntry.js

import mongoose from 'mongoose';

const TimeEntrySchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },

    activityCode: { type: String },
    narrative: { type: String, required: true },

    billableMinutes: { type: Number, min: 0, default: 0 },
    nonbillableMinutes: { type: Number, min: 0, default: 0 },

    rateApplied: { type: Number, min: 0 },
    amount: { type: Number, min: 0 },
    date: { type: Date, default: () => new Date() },

    status: { type: String, enum: ['draft', 'submitted', 'approved', 'billed', 'paid', 'rejected'], default: 'draft', index: true },

    external: {
      system: { type: String },
      entryId: { type: String },
      syncedAt: { type: Date },
    },
  },
  { timestamps: true }
);

TimeEntrySchema.index({ clientId: 1, caseId: 1, date: -1 });

export const TimeEntry = mongoose.model('TimeEntry', TimeEntrySchema);
