import mongoose from 'mongoose';

const CaseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  status: { type: String, enum: ['open', 'closed', 'pending'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
  assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  primaryLawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  case_type: { type: String, required: true, trim: true },
  case_type_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
});

const Case = mongoose.model('Case', CaseSchema);
export default Case;
