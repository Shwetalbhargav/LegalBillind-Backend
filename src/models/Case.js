import mongoose from 'mongoose';

const CaseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  status: { type: String, enum: ['open', 'closed', 'pending'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
  assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  primaryLawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const Case = mongoose.model('Case', CaseSchema);
export default Case;
