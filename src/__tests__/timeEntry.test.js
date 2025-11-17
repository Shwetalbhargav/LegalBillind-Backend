import { connectMongo, disconnectMongo } from '../db/connect.js';
import { TimeEntry } from '../models/TimeEntry.js';

beforeAll(async () => { await connectMongo(); });
afterAll(async () => { await disconnectMongo(); });

test('TimeEntry defaults and validation', async () => {
  const te = new TimeEntry({
    caseId: '000000000000000000000000',
    clientId: '000000000000000000000000',
    userId: '000000000000000000000000',
    narrative: 'Email to client about hearing date',
    billableMinutes: 30,
    rateApplied: 4000, // INR per hour
    amount: Math.round((30/60) * 4000),
  });
  expect(te.status).toBe('draft');
  expect(te.amount).toBe(2000);
});