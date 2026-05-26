import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import {
  Admin,
  AssociateProfile,
  Case,
  Client,
  Firm,
  InternProfile,
  LawyerProfile,
  PartnerProfile,
  RateCard,
  User,
} from '../models/index.js';

dotenv.config();

const DEMO_PASSWORD = 'test@123';
const DEMO_FIRM_NAME = 'Harmon & Associates';

const users = [
  {
    key: 'rekha',
    name: 'Rekha Nair',
    email: 'rekha@harmonassociates.in',
    mobile: '9810000001',
    role: 'admin',
  },
  {
    key: 'arvind',
    name: 'Arvind Harmon',
    email: 'arvind@harmonassociates.in',
    mobile: '9810000002',
    role: 'partner',
    billingRate: 4000,
    profile: {
      title: 'Managing Partner',
      specialization: ['Corporate', 'M&A'],
      experienceYears: 22,
    },
  },
  {
    key: 'priya',
    name: 'Priya Mehta',
    email: 'priya@harmonassociates.in',
    mobile: '9810000003',
    role: 'partner',
    billingRate: 3800,
    profile: {
      title: 'Senior Partner',
      specialization: ['Intellectual Property', 'Technology Law'],
      experienceYears: 18,
    },
  },
  {
    key: 'karan',
    name: 'Karan Sethi',
    email: 'karan@harmonassociates.in',
    mobile: '9810000004',
    role: 'lawyer',
    billingRate: 2500,
    profile: {
      specialization: ['Litigation', 'Arbitration'],
      experienceYears: 6,
    },
  },
  {
    key: 'ananya',
    name: 'Ananya Rao',
    email: 'ananya@harmonassociates.in',
    mobile: '9810000005',
    role: 'lawyer',
    billingRate: 2500,
    profile: {
      specialization: ['Corporate', 'Contracts'],
      experienceYears: 5,
    },
  },
  {
    key: 'rohit',
    name: 'Rohit Bhatt',
    email: 'rohit@harmonassociates.in',
    mobile: '9810000006',
    role: 'associate',
    billingRate: 1500,
    profile: {
      specialization: ['Research', 'Drafting'],
      experienceYears: 2,
    },
  },
  {
    key: 'sneha',
    name: 'Sneha Pillai',
    email: 'sneha@harmonassociates.in',
    mobile: '9810000007',
    role: 'intern',
    billingRate: 750,
    profile: {
      lawSchool: 'National Law University Delhi',
      graduationYear: 2026,
      internshipFocus: 'Research and drafting',
    },
  },
];

async function upsertRoleProfile(user, definition, userByKey) {
  if (definition.role === 'admin') {
    await Admin.findOneAndUpdate(
      { userId: user._id },
      { $set: { firmId: user.firmId, role: 'firm_admin' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return;
  }

  if (definition.role === 'partner') {
    await PartnerProfile.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          ...definition.profile,
          billingRate: definition.billingRate,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return;
  }

  if (definition.role === 'lawyer') {
    await LawyerProfile.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          ...definition.profile,
          billingRate: definition.billingRate,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return;
  }

  if (definition.role === 'associate') {
    await AssociateProfile.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          ...definition.profile,
          billingRate: definition.billingRate,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return;
  }

  if (definition.role === 'intern') {
    await InternProfile.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          ...definition.profile,
          mentor: userByKey.karan?._id,
          billingRate: definition.billingRate,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

async function seed() {
  await connectDB();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const firm = await Firm.findOneAndUpdate(
    { name: DEMO_FIRM_NAME },
    {
      $set: {
        name: DEMO_FIRM_NAME,
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
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const userByKey = {};
  for (const definition of users) {
    const user = await User.findOneAndUpdate(
      { mobile: definition.mobile },
      {
        $set: {
          name: definition.name,
          email: definition.email,
          mobile: definition.mobile,
          role: definition.role,
          firmId: firm._id,
          passwordHash,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    userByKey[definition.key] = user;
  }

  for (const definition of users) {
    await upsertRoleProfile(userByKey[definition.key], definition, userByKey);
  }

  const client = await Client.findOneAndUpdate(
    { displayName: 'Nimbus Retail Pvt Ltd', firmId: firm._id },
    {
      $set: {
        displayName: 'Nimbus Retail Pvt Ltd',
        firmId: firm._id,
        ownerUserId: userByKey.priya._id,
        status: 'active',
        paymentTerms: 'NET30',
        email: 'legal@nimbusretail.in',
        phone: '011-4000-0101',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  const matter = await Case.findOneAndUpdate(
    { clientId: client._id, title: 'Contract Review - FY25 MSA' },
    {
      $set: {
        clientId: client._id,
        title: 'Contract Review - FY25 MSA',
        description: 'Review and negotiation of master services agreement.',
        leadPartnerId: userByKey.priya._id,
        managingLawyerId: userByKey.karan._id,
        assignedUsers: [userByKey.priya._id, userByKey.karan._id, userByKey.rohit._id],
        billingType: 'hourly',
        status: 'open',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  for (const definition of users.filter((entry) => entry.billingRate)) {
    await RateCard.findOneAndUpdate(
      {
        userId: userByKey[definition.key]._id,
        caseId: matter._id,
        activityCode: null,
        effectiveFrom: new Date('2025-01-01'),
      },
      {
        $set: {
          userId: userByKey[definition.key]._id,
          caseId: matter._id,
          ratePerHour: definition.billingRate,
          effectiveFrom: new Date('2025-01-01'),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
  }

  console.log('Demo seed complete');
  console.table(
    users.map((user) => ({
      name: user.name,
      role: user.role,
      mobile: user.mobile,
      password: DEMO_PASSWORD,
    }))
  );
  console.log('Firm:', { id: firm._id.toString(), name: firm.name });
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
