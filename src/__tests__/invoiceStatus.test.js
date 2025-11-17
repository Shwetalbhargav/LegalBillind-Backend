import { connectMongo, disconnectMongo } from '../db/connect.js';
import { Invoice } from '../models/Invoice.js';

beforeAll(async () => { await connectMongo(); });
afterAll(async () => { await disconnectMongo(); });

test('Invoice.computeStatus returns correct statuses', async () => {
  const inv = new Invoice({ clientId: globalThis.crypto?.randomUUID?.() || '000000000000000000000000', total: 1000, issueDate: new Date(), dueDate: new Date(Date.now() - 86400000) });
  expect(inv.computeStatus(0)).toBe('overdue');
  inv.status = 'sent';
  inv.dueDate = new Date(Date.now() + 86400000);
  expect(inv.computeStatus(0)).toBe('sent');
  expect(inv.computeStatus(100)).toBe('partial');
  expect(inv.computeStatus(1000)).toBe('paid');
});