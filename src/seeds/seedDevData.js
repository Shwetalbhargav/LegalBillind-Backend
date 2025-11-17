import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from '../db/connect.js';
import { Firm, Client, Case, RateCard, Activity, TimeEntry, Invoice, InvoiceLine, Payment } from '../models/index.js';

function oid() { return new mongoose.Types.ObjectId(); }

async function run() {
  await connectMongo();

  // Clean minimal collections for fresh seed
  await Promise.all([
    Firm.deleteMany({}), Client.deleteMany({}), Case.deleteMany({}), RateCard.deleteMany({}),
    Activity.deleteMany({}), TimeEntry.deleteMany({}), Invoice.deleteMany({}), InvoiceLine.deleteMany({}), Payment.deleteMany({}),
  ]);

  const firm = await Firm.create({ name: 'Acme Legal LLP', currency: 'INR', taxSettings: { taxName: 'GST', taxRatePct: 18, inclusive: false } });

  const client = await Client.create({ displayName: 'Nimbus Retail Pvt Ltd', firmId: firm._id, status: 'active', paymentTerms: 'NET30' });

  const matter = await Case.create({ clientId: client._id, title: 'Contract Review – FY25 MSA', billingType: 'hourly' });

  // RateCard for user
  const userId = oid();
  await RateCard.create({ userId, caseId: matter._id, ratePerHour: 6000, effectiveFrom: new Date('2025-01-01') });

  // Activity + TimeEntry
  const act = await Activity.create({ caseId: matter._id, clientId: client._id, userId, activityType: 'email', durationMinutes: 25, narrative: 'Emailed redlines summary' });

  const amount = Math.round((25 / 60) * 6000);
  const te = await TimeEntry.create({ caseId: matter._id, clientId: client._id, userId, activityId: act._id, narrative: 'Email: redlines summary', billableMinutes: 25, rateApplied: 6000, amount, status: 'approved' });

  // Invoice + line + payment
  const inv = await Invoice.create({ clientId: client._id, caseId: matter._id, currency: 'INR', issueDate: new Date(), dueDate: new Date(Date.now() + 7*86400000), subtotal: amount, tax: Math.round(amount * 0.18), total: Math.round(amount * 1.18), status: 'sent' });

  await InvoiceLine.create({ invoiceId: inv._id, timeEntryId: te._id, description: te.narrative, qtyHours: 25/60, rate: 6000, amount });

  await Payment.create({ invoiceId: inv._id, amount: inv.total, method: 'upi', receivedDate: new Date(), reference: 'UTR123456' });

  console.log('Seed complete:', { firm: firm._id.toString(), client: client._id.toString(), case: matter._id.toString(), invoice: inv._id.toString() });
  await disconnectMongo();
}

run().catch(async (e) => { console.error(e); await disconnectMongo(); process.exit(1); });