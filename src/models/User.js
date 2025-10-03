import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  role: { 
    type: String, 
    enum: ['partner', 'lawyer', 'associate', 'intern', 'admin'], 
    default: 'lawyer' 
  },
  firmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm' },
  passwordHash: { type: String, required: true },
  photoUrl: { type: String, default: '/images/default-user.jpg' },

  // 🔹 New universal fields
  mobile: { type: String ,required: true},
  address: { type: String },
  qualifications: [
    {
      degree: { type: String },
      university: { type: String },
      year: { type: Number }
    }
  ]
});

const User = mongoose.model('User', UserSchema);
export default User;
