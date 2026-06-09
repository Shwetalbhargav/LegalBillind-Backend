import { expect, test } from 'vitest';
import { Invoice } from '../modules/invoices/models/Invoice.js';
import { computeTotalsFromLines } from '../modules/invoices/services/invoiceTotalsService.js';

test('Invoice.computeStatus returns correct statuses', async () => {
  const inv = new Invoice({ clientId: globalThis.crypto?.randomUUID?.() || '000000000000000000000000', total: 1000, issueDate: new Date(), dueDate: new Date(Date.now() - 86400000) });
  expect(inv.computeStatus(0)).toBe('overdue');
  inv.status = 'sent';
  inv.dueDate = new Date(Date.now() + 86400000);
  expect(inv.computeStatus(0)).toBe('sent');
  expect(inv.computeStatus(100)).toBe('partial');
  expect(inv.computeStatus(1000)).toBe('paid');
});

test('computeTotalsFromLines applies exclusive GST', () => {
  const totals = computeTotalsFromLines(
    [{ amount: 1000 }, { amount: 500 }],
    { taxName: 'GST', taxRatePct: 18, inclusive: false }
  );

  expect(totals.subtotal).toBe(1500);
  expect(totals.tax).toBe(270);
  expect(totals.total).toBe(1770);
  expect(totals.taxDetails).toMatchObject({
    taxName: 'GST',
    taxRatePct: 18,
    inclusive: false,
    taxableAmount: 1500,
    taxAmount: 270,
    grossAmount: 1770,
  });
});

test('computeTotalsFromLines extracts inclusive GST', () => {
  const totals = computeTotalsFromLines(
    [{ amount: 1180 }],
    { taxName: 'GST', taxRatePct: 18, inclusive: true }
  );

  expect(totals.subtotal).toBe(1000);
  expect(totals.tax).toBe(180);
  expect(totals.total).toBe(1180);
});
