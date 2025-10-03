import mongoose from 'mongoose';

const LawyerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  specialization: { type: [String], default: [] },
  experienceYears: Number,
  landmarkCases: [
    { caseTitle: String, year: Number, description: String }
  ],
  achievements: [
    { title: String, year: Number, description: String }
  ],
  billingRate: { type: Number, default: 2500 }  // INR
});

const LawyerProfile = mongoose.model('LawyerProfile', LawyerProfileSchema);
export default LawyerProfile;
