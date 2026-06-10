// src/controllers/paymentController.js
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Payment } from '../models/Payment.js';
import { Invoice } from '../../invoices/models/Invoice.js';

const PORTAL_TOKEN_DAYS = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function buildAudit(action, req, changes, note) {
  return {
    action,
    actorId: req.user?.id,
    at: new Date(),
    changes,
    note,
  };
}

/** Recalculate an invoice's status from cleared payments and persist */
async function recomputeInvoiceStatus(invoiceId, session = null) {
  const cleared = await Payment.aggregate([
    { $match: { invoiceId: new mongoose.Types.ObjectId(invoiceId), status: 'cleared', transactionType: { $in: ['payment', 'write_off'] } } },
    {
      $group: {
        _id: '$invoiceId',
        paid: {
          $sum: {
            $cond: [{ $eq: ['$transactionType', 'refund'] }, { $multiply: ['$amount', -1] }, '$amount']
          }
        }
      }
    },
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

    const payment = await Payment.create([{
      ...data,
      transactionType: data.transactionType || 'payment',
      receivedBy: data.receivedBy || req.user?.id,
      auditTrail: [buildAudit('created', req, { status: data.status || 'cleared', amount: data.amount })],
    }], { session });
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

    const previousStatus = payment.status;
    if (receivedDate) payment.receivedDate = new Date(receivedDate);
    payment.status = status;
    payment.auditTrail.push(buildAudit('reconciled', req, { status: { from: previousStatus, to: status } }));
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
    const payment = await Payment.findById(id).session(session);
    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Payment not found' });
    }
    const previousStatus = payment.status;
    payment.status = 'failed';
    payment.auditTrail.push(buildAudit('voided', req, { status: { from: previousStatus, to: 'failed' } }, 'Payment voided instead of hard deleted for audit retention'));
    await payment.save({ session });
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

export const createWriteOff = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const inv = await Invoice.findById(req.body.invoiceId).session(session);
    if (!inv) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (inv.status === 'void') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Cannot write off a void invoice' });
    }
    const [payment] = await Payment.create([{
      invoiceId: req.body.invoiceId,
      amount: req.body.amount,
      transactionType: 'write_off',
      method: 'other',
      receivedDate: new Date(),
      reference: req.body.reference,
      status: 'cleared',
      receivedBy: req.user?.id,
      notes: req.body.notes,
      auditTrail: [buildAudit('write_off_created', req, { amount: req.body.amount }, req.body.notes)],
    }], { session });
    const result = await recomputeInvoiceStatus(inv._id, session);
    await session.commitTransaction();
    res.status(201).json({ payment, invoice: result?.invoice, paidAmount: result?.paidAmount, status: result?.newStatus });
  } catch (e) {
    await session.abortTransaction();
    res.status(500).json({ error: 'Failed to create write-off' });
  } finally {
    session.endSession();
  }
};

export const financeSummary = async (_req, res) => {
  try {
    const [invoiceAgg, paymentAgg] = await Promise.all([
      Invoice.aggregate([
        { $match: { status: { $ne: 'void' } } },
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: { $ifNull: ['$total', 0] } } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'cleared' } },
        { $group: { _id: '$transactionType', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
    ]);
    const invoiceTotal = invoiceAgg.reduce((sum, row) => sum + row.total, 0);
    const clearedPayments = paymentAgg.filter((row) => row._id === 'payment').reduce((sum, row) => sum + row.total, 0);
    const writeOffs = paymentAgg.filter((row) => row._id === 'write_off').reduce((sum, row) => sum + row.total, 0);
    res.json({
      ok: true,
      data: {
        invoiceTotal,
        clearedPayments,
        writeOffs,
        outstanding: Math.max(invoiceTotal - clearedPayments - writeOffs, 0),
        invoiceByStatus: invoiceAgg,
        paymentByType: paymentAgg,
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to build finance summary' });
  }
};

export const createPortalLink = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId).populate('clientId', 'displayName name email');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'void') return res.status(400).json({ error: 'Cannot create payment portal for a void invoice' });
    const token = crypto.randomBytes(24).toString('base64url');
    invoice.paymentPortal = {
      enabled: true,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + PORTAL_TOKEN_DAYS * 24 * 60 * 60 * 1000),
      lastGeneratedAt: new Date(),
    };
    await invoice.save();
    const frontend = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    res.json({
      ok: true,
      data: {
        token,
        url: `${frontend}/pay/${token}`,
        expiresAt: invoice.paymentPortal.expiresAt,
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create payment portal link' });
  }
};

async function loadPortalInvoice(token) {
  const tokenHash = hashToken(token);
  return Invoice.findOne({
    'paymentPortal.enabled': true,
    'paymentPortal.tokenHash': tokenHash,
    'paymentPortal.expiresAt': { $gt: new Date() },
  }).populate('clientId', 'displayName name email').populate('caseId', 'title name');
}

export const getPortalInvoice = async (req, res) => {
  try {
    const invoice = await loadPortalInvoice(req.params.token);
    if (!invoice) return res.status(404).json({ ok: false, message: 'Payment link is invalid or expired' });
    const paid = await Payment.aggregate([
      { $match: { invoiceId: invoice._id, status: 'cleared', transactionType: { $in: ['payment', 'write_off'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const paidAmount = paid[0]?.total || 0;
    res.json({
      ok: true,
      data: {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber || String(invoice._id),
        clientName: invoice.clientId?.displayName || invoice.clientId?.name,
        matter: invoice.caseId?.title || invoice.caseId?.name,
        currency: invoice.currency || 'INR',
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        paidAmount,
        outstanding: Math.max(Number(invoice.total || 0) - paidAmount, 0),
        dueDate: invoice.dueDate,
        status: invoice.status,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to load payment link' });
  }
};

export const submitPortalPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const invoice = await loadPortalInvoice(req.params.token);
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({ ok: false, message: 'Payment link is invalid or expired' });
    }
    const [payment] = await Payment.create([{
      invoiceId: invoice._id,
      amount: req.body.amount,
      method: req.body.method,
      receivedDate: new Date(),
      reference: req.body.reference,
      status: 'pending',
      notes: req.body.notes,
      transactionType: 'payment',
      portal: {
        submittedByClient: true,
        payerName: req.body.payerName,
        payerEmail: req.body.payerEmail,
        submittedAt: new Date(),
      },
      auditTrail: [{ action: 'portal_submitted', at: new Date(), changes: { amount: req.body.amount, method: req.body.method } }],
    }], { session });
    await session.commitTransaction();
    res.status(201).json({ ok: true, data: { paymentId: payment._id, status: payment.status } });
  } catch (e) {
    await session.abortTransaction();
    res.status(500).json({ ok: false, message: 'Failed to submit portal payment' });
  } finally {
    session.endSession();
  }
};
