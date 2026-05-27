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
    roundedDurationMinutes: { type: Number, min: 0 },
    workDate: { type: Date, index: true },
    roundingPolicy: { type: String, enum: ['exact', 'six_minute', 'fifteen_minute'], default: 'exact' },
    billable: { type: Boolean, default: true, index: true },
    durationOverrideReason: { type: String },

    source: { type: String, enum: ['gmail', 'extension', 'research', 'manual', 'integration', 'system'], default: 'extension' },
    sourceRef: { type: String },

    narrative: { type: String },
    activityCode: { type: String },
    timezone: { type: String },

    status: { type: String, enum: ['captured', 'reviewed', 'converted', 'ignored', 'locked', 'voided'], default: 'captured', index: true },
    conversionStatus: { type: String, enum: ['unconverted', 'converted'], default: 'unconverted', index: true },
    convertedTimeEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'TimeEntry' },
    convertedAt: { type: Date },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ignoredAt: { type: Date },
    ignoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lockedAt: { type: Date },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voidedAt: { type: Date },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voidReason: { type: String },
    auditTrail: {
      type: [{
        action: { type: String, required: true },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        reason: { type: String },
        changes: { type: mongoose.Schema.Types.Mixed },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

ActivitySchema.index({ caseId: 1, userId: 1, createdAt: -1 });
ActivitySchema.index({ userId: 1, workDate: -1, status: 1 });
ActivitySchema.index({ caseId: 1, workDate: -1, status: 1 });
ActivitySchema.index(
  { userId: 1, source: 1, sourceRef: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceRef: { $exists: true, $type: 'string' },
    },
  }
);

export const Activity = mongoose.model('Activity', ActivitySchema);
export default Activity;
