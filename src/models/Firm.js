import mongoose from 'mongoose';

const FirmSchema = new mongoose.Schema({
  name: { type: String, required: true },
  billingPreferences: {
    defaultRate: { type: Number }, // default $/hour
    currency: { type: String, default: 'INR' },
    autoSync: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now }
});

const Firm = mongoose.model('Firm', FirmSchema);
export default Firm;
