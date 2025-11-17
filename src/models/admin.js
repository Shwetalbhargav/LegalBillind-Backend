// src/models/admin.js

import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  firmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true },
  role: { type: String, enum: ['firm_admin', 'super_admin'], default: 'firm_admin' }
}, { timestamps: true });

AdminSchema.index({ userId: 1 }, { unique: true });
AdminSchema.index({ firmId: 1 });

const Admin = mongoose.model('Admin', AdminSchema);
export default Admin;
