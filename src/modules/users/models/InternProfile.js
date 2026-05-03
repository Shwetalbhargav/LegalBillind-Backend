// src/models/InternProfile.js

import mongoose from 'mongoose';

const InternProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  lawSchool: String,
  graduationYear: Number,
  mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  internshipFocus: String,
  billingRate: { type: Number, default: 750 }  // INR
});

const InternProfile = mongoose.model('InternProfile', InternProfileSchema);
export default InternProfile;
