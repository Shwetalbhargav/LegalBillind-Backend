// src/models/PartnerProfile.js

import mongoose from 'mongoose';

const PartnerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  title: String,                      // e.g. Managing Partner
  specialization: { type: [String], default: [] },             // Arbitration, Corporate Law
  experienceYears: Number,
  landmarkCases: [
    { caseTitle: String, year: Number, description: String }
  ],
  achievements: [
    { title: String, year: Number, description: String }
  ],
  publications: [
    { title: String, link: String, year: Number }
  ],
  billingRate: { type: Number, default: 4000 }  // INR
});

const PartnerProfile = mongoose.model('PartnerProfile', PartnerProfileSchema);
export default PartnerProfile;
