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

    mappedClientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    mappedCaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },

    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },

    billableSummary: { type: String },
    workDate: { type: Date, default: Date.now },
    rate: { type: Number },

    source: { type: String, enum: ['gmail', 'extension'], default: 'extension' },
  },
  { timestamps: true }
);

EmailEntrySchema.index({ recipient: 1, subject: 1, createdAt: -1 });

export const EmailEntry = mongoose.model('EmailEntry', EmailEntrySchema);