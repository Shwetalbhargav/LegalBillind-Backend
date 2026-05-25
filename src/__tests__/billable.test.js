import { expect, test } from 'vitest';
import {
  Billable,
  billableStatusQuery,
  normalizeBillableStatus,
} from '../modules/billables/models/Billable.js';

const baseBillable = {
  caseId: '000000000000000000000001',
  clientId: '000000000000000000000002',
  userId: '000000000000000000000003',
  category: 'Legal research',
  description: 'Research on maintainability',
  durationMinutes: 60,
  rate: 5000,
  amount: 5000,
  date: new Date('2026-05-25T00:00:00.000Z'),
};

test('Billable normalizes legacy statuses to canonical lowercase values', async () => {
  const pending = new Billable({ ...baseBillable, status: 'Pending' });
  const logged = new Billable({ ...baseBillable, status: 'Logged' });
  const failed = new Billable({ ...baseBillable, status: 'Failed' });

  await expect(pending.validate()).resolves.toBeUndefined();
  await expect(logged.validate()).resolves.toBeUndefined();
  await expect(failed.validate()).resolves.toBeUndefined();

  expect(pending.status).toBe('pending');
  expect(logged.status).toBe('billed');
  expect(failed.status).toBe('rejected');
});

test('Billable status helpers include legacy aliases for migration-safe queries', () => {
  expect(normalizeBillableStatus('Logged')).toBe('billed');
  expect(billableStatusQuery('billed')).toEqual({ $in: ['billed', 'Logged'] });
});
