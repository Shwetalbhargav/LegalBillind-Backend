// src/models/User.js

import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  email: {type: String, required: false, trim: true  },
  role: { 
    type: String, 
    enum: ['partner', 'lawyer', 'associate', 'intern', 'admin'], 
    required: true,
    default: 'lawyer'
  },
  firmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm' },
  passwordHash: { type: String, required: true },
  photoUrl: { type: String, default: '/images/default-user.jpg' },

  // Login identifier we use in the controller:
  mobile: { type: String, unique: true, sparse: true, trim: true, required: true },

  // Optional universal profile-ish fields (ok to keep)
  address: { type: String },
  qualifications: [
    { degree: String, university: String, year: Number }
  ]
});
UserSchema.index({ name: 1 }, { unique: true });
UserSchema.index({ mobile: 1 }, { unique: true, sparse: true });

const User = mongoose.model('User', UserSchema);
export default User;
