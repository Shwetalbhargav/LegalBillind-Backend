// src/controllers/paymentController.js
import mongoose from 'mongoose';
import { Payment } from '../models/Payment.js';
import { Invoice } from '../models/Invoice.js';

/** Recalculate an invoice's status from cleared payments and persist */
async function recomputeInvoiceStatus(invoiceId, session = null) {
  const cleared = await Payment.aggregate([
    { $match: { invoiceId: new mongoose.Types.ObjectId(invoiceId), status: 'cleared' } },
    { $group: { _id: '$invoiceId', paid: { $sum: '$amount' } } },
  ]);
  const paidAmount = cleared[0]?.paid || 0;

  const inv = await Invoice.findById(invoiceId).session(session);
  if (!inv) return null;

  const newStatus = inv.computeStatus(paidAmount);
  inv.status = newStatus;
  await inv.save({ session });
  return { invoice: inv, paidAmount, newStatus };
}

/**
 * GET /api/payments
 * Query: invoiceId?, status?, from?, to?
 */
export const listPayments = async (req, res) => {
  try {
    const { invoiceId, status, from, to } = req.query;
    const q = {};
    if (invoiceId) q.invoiceId = invoiceId;
    if (status) q.status = status;
    if (from || to) {
      q.receivedDate = {};
      if (from) q.receivedDate.$gte = new Date(from);
      if (to) q.receivedDate.$lte = new Date(to);
    }
    const rows = await Payment.find(q).sort({ receivedDate: -1 });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list payments' });
  }
};

/**
 * POST /api/payments
 * Body: { invoiceId, amount, method, receivedDate, reference?, status?, receivedBy?, notes? }
 * Side-effects: updates related invoice.status based on cleared payments.
 */
export const createPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const data = req.body || {};
    if (!data.invoiceId) return res.status(400).json({ error: 'invoiceId is required' });

    const inv = await Invoice.findById(data.invoiceId).session(session);
    if (!inv) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (inv.status === 'void') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Cannot record payment against a void invoice' });
    }

    const payment = await Payment.create([data], { session });
    const result = await recomputeInvoiceStatus(inv._id, session);

    await session.commitTransaction();
    session.endSession();
    res.status(201).json({ payment: payment[0], invoice: result?.invoice, paidAmount: result?.paidAmount, status: result?.newStatus });
  } catch (e) {
    console.error(e);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: 'Failed to create payment' });
  }
};

/**
 * POST /api/payments/:id/reconcile
 * Body: { status: 'cleared' | 'failed' | 'pending', receivedDate? }
 * Side-effects: updates related invoice.status
 */
export const reconcilePayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { status, receivedDate } = req.body || {};
    if (!['cleared', 'failed', 'pending'].includes(status)) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Invalid status' });
    }

    const payment = await Payment.findById(id).session(session);
    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (receivedDate) payment.receivedDate = new Date(receivedDate);
    payment.status = status;
    await payment.save({ session });

    const result = await recomputeInvoiceStatus(payment.invoiceId, session);

    await session.commitTransaction();
    session.endSession();
    res.json({ payment, invoice: result?.invoice, paidAmount: result?.paidAmount, status: result?.newStatus });
  } catch (e) {
    console.error(e);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: 'Failed to reconcile payment' });
  }
};

/**
 * DELETE /api/payments/:id
 * Side-effects: updates related invoice.status
 */
export const deletePayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const payment = await Payment.findByIdAndDelete(id, { session });
    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Payment not found' });
    }
    const result = await recomputeInvoiceStatus(payment.invoiceId, session);

    await session.commitTransaction();
    session.endSession();
    res.json({ success: true, invoice: result?.invoice, paidAmount: result?.paidAmount, status: result?.newStatus });
  } catch (e) {
    console.error(e);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: 'Failed to delete payment' });
  }
};
