import mongoose from 'mongoose';

const AssociateProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  specialization: { type: [String], default: [] },
  experienceYears: Number,
  achievements: [
    { title: String, year: Number, description: String }
  ],
  billingRate: { type: Number, default: 1500 }  // INR
});

const AssociateProfile = mongoose.model('AssociateProfile', AssociateProfileSchema);
export default AssociateProfile;
