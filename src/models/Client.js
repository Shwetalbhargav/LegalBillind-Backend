import mongoose from 'mongoose';

const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  contactInfo: { type: String },
  firmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm' },
  createdAt: { type: Date, default: Date.now },
  accountManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

});

const Client = mongoose.model('Client', ClientSchema);
export default Client;
