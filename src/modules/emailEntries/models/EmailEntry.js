// src/models/EmailEntry.js

import mongoose from 'mongoose';

const EmailEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userEmail: { type: String },

    recipient: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String },

    typingTimeSeconds: { type: Number, min: 0 },
    typingTimeMinutes: { type: Number, min: 0 },
    typingTimeMinSec: { type: String },

    mappedClientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    mappedCaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },

    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },

    billableSummary: { type: String },
    workDate: { type: Date, default: Date.now },
    rate: { type: Number },

    source: { type: String, enum: ['gmail', 'extension', 'research'], default: 'extension', index: true },
    sourceRef: { type: String, trim: true },
    messageId: { type: String, trim: true },
    threadId: { type: String, trim: true },
    url: { type: String, trim: true },
    domain: { type: String, trim: true, lowercase: true },
    status: {
      type: String,
      enum: ['captured', 'mapped', 'converted', 'billed'],
      default: 'captured',
      index: true,
    },
    mappedAt: { type: Date },
    convertedAt: { type: Date },
    billedAt: { type: Date },
    schemaVersion: { type: Number, default: 1 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

EmailEntrySchema.index({ recipient: 1, subject: 1, createdAt: -1 });
EmailEntrySchema.index(
  { userId: 1, source: 1, sourceRef: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceRef: { $exists: true, $type: 'string' },
    },
  }
);
EmailEntrySchema.index({ userId: 1, status: 1, createdAt: -1 });
EmailEntrySchema.index({ userId: 1, domain: 1, createdAt: -1 });

export const EmailEntry = mongoose.model('EmailEntry', EmailEntrySchema);
export default EmailEntry;
