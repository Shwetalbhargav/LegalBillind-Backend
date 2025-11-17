// CaseAssignment.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const CaseAssignmentSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['partner', 'associate', 'admin', 'primary'], default: 'associate' },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },

    // ✅ New fields for analytics/filtering
    firmId: { type: Schema.Types.ObjectId, ref: 'Firm', index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', index: true }
  },
  { timestamps: true }
);

// Useful compound indexes
CaseAssignmentSchema.index({ caseId: 1, userId: 1 }, { unique: true });
CaseAssignmentSchema.index({ firmId: 1, clientId: 1, status: 1 });
CaseAssignmentSchema.index({ caseId: 1, status: 1 });

module.exports = mongoose.model('CaseAssignment', CaseAssignmentSchema);
