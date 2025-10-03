import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
  // Keep this in sync with core User fields that apply to admins
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  role: { type: String, enum: ['admin'], default: 'admin', required: true },
  firmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm' },
  passwordHash: { type: String, required: true },
  mobile: { type: String },
  address: { type: String },
  qualifications: [
    {
      degree: { type: String },
      university: { type: String },
      year: { type: Number }
    }
  ]
},
{
  timestamps: true
});

// Helpful indexes for admin lookups
AdminSchema.index({ email: 1 }, { unique: true });
AdminSchema.index({ firmId: 1 });

const Admin = mongoose.model('Admin', AdminSchema);
export default Admin;
