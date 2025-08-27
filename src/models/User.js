import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  role: { type: String, enum: ['partner', 'lawyer', 'associate', 'intern', 'admin'], default: 'lawyer' },
  firmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm' },
  passwordHash: { type: String,required: true },  
  billingRate: { type: Number },

 
});

const User = mongoose.model('User', UserSchema);
export default User;
