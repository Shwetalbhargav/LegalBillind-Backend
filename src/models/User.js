import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  role: { type: String, enum: ['partner', 'lawyer', 'associate', 'intern', 'admin'], default: 'lawyer' },
  firmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm' },

 passwordHash: { 
   type: String, 
   required: function () { return this.authProvider === 'local'; } 
 },
  billingRate: { type: Number },

 authProvider: { type: String, enum: ['local', 'oauth', 'magic'], default: 'local' },
  emailVerified: { type: Boolean, default: false },
  verifyTokenHash: String,
  verifyExpires: Date,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
export default User;
