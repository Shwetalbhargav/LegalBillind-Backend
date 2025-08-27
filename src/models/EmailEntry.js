import mongoose from 'mongoose';

const EmailEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  caseId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  recipient: { type: String, required: true },
  subject: { type: String, required: true },
  typingTimeMinutes: { type: Number, required: true },
  billableSummary: { type: String },
  workDate: { type: Date, default: Date.now },
  rate: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

const EmailEntry = mongoose.model('EmailEntry', EmailEntrySchema);

export default EmailEntry;
