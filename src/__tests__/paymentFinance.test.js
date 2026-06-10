import { expect, test } from 'vitest';
import { Payment } from '../modules/payments/models/Payment.js';
import { Invoice } from '../modules/invoices/models/Invoice.js';

test('Payment supports audit trail and portal metadata', async () => {
  const payment = new Payment({
    invoiceId: '000000000000000000000001',
    amount: 2500,
    method: 'upi',
    receivedDate: new Date('2026-06-09T10:00:00.000Z'),
    status: 'pending',
    portal: {
      submittedByClient: true,
      payerName: 'Client Finance',
      payerEmail: 'finance@example.com',
      submittedAt: new Date(),
    },
    auditTrail: [{ action: 'portal_submitted', changes: { amount: 2500 } }],
  });

  await expect(payment.validate()).resolves.toBeUndefined();
  expect(payment.transactionType).toBe('payment');
  expect(payment.auditTrail[0].action).toBe('portal_submitted');
});

test('Invoice supports payment portal token metadata', async () => {
  const invoice = new Invoice({
    clientId: '000000000000000000000001',
    total: 1000,
    paymentPortal: {
      enabled: true,
      tokenHash: 'abc123',
      expiresAt: new Date('2026-07-09T10:00:00.000Z'),
    },
  });

  await expect(invoice.validate()).resolves.toBeUndefined();
  expect(invoice.paymentPortal.enabled).toBe(true);
});
