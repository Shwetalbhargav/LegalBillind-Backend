import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { Firm } from '../models/index.js';

dotenv.config();

const firmPayload = {
  name: 'Harmon & Associates',
  currency: 'INR',
  taxSettings: {
    taxName: 'GST',
    taxRatePct: 18,
    inclusive: false,
  },
  address: {
    line1: '14 Barakhamba Road',
    line2: 'Connaught Place',
    city: 'New Delhi',
    state: 'Delhi',
    postalCode: '110001',
    country: 'IN',
  },
  billingPreferences: {
    defaultRate: 2500,
    autoSync: false,
  },
};

async function seedFirm() {
  await connectDB();

  const firm = await Firm.findOneAndUpdate(
    { name: firmPayload.name },
    { $set: firmPayload },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  console.log('Firm seed complete:', {
    id: firm._id.toString(),
    name: firm.name,
  });
}

seedFirm()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
