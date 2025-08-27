// models/TeamAssignment.js
import mongoose from 'mongoose';

const TeamAssignmentSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['lead', 'support', 'intern'], required: true }
}, {
  timestamps: true
});

const TeamAssignment = mongoose.model('TeamAssignment', TeamAssignmentSchema);
export default TeamAssignment;
