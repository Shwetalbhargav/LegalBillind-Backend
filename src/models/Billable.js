// models/Billable.js
import mongoose from 'mongoose';

const BillableSchema = new mongoose.Schema({
  caseId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Added to match frontend/controller
  subject: { type: String },
  status:  { type: String, enum: ['Pending', 'Logged', 'Failed'], default: 'Pending' },
  activityCode: {
    type: String,
    enum: ['EMAIL','CALL','MEETING','DOC_REVIEW','RESEARCH','NEGOTIATION','ADMIN','OTHER'],
    default: 'EMAIL'
  },

  // Existing fields (used by controller & invoices)
  category: {
    type: String,
    enum: [
      'Email drafting/review',
      'Contract drafting/review',
      'Legal research',
      'Client consultation (calls/meetings)',
      'Case preparation/documentation',
      'Court appearance or hearing attendance',
      'Negotiation/settlement discussions',
      'IP filing & compliance work',
      'Dispute resolution activities',
      'Miscellaneous administrative legal work'
    ],
    required: true
  },
  description:     { type: String, required: true },
  durationMinutes: { type: Number, required: true },
  rate:            { type: Number, required: true },
  amount:          { type: Number, required: true },
  date:            { type: Date, required: true },

  // optional push metadata
  pushedAt:        { type: Date },
  externalEntryId: { type: String }
}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true }
});

BillableSchema.virtual('hours').get(function () {
  return this.durationMinutes / 60;
});

const Billable = mongoose.model('Billable', BillableSchema);
export default Billable;
