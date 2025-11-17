// src/controllers/invoiceController.js
import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.js';
import { InvoiceLine } from '../models/InvoiceLine.js';
import { TimeEntry } from '../models/TimeEntry.js';

/**
 * Utility: recalc invoice totals from InvoiceLine rows
 */
async function recalcTotals(invoiceId) {
  const lines = await InvoiceLine.find({ invoiceId });
  const subtotal = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const tax = 0; // extend later if you add tax rules
  const total = Number((subtotal + tax).toFixed(2));
  await Invoice.findByIdAndUpdate(invoiceId, { subtotal, tax, total });
  return { subtotal, tax, total };
}

/**
 * GET /api/invoices/:id
 */
export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('clientId caseId createdBy');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const lines = await InvoiceLine.find({ invoiceId: invoice._id })
      .populate('timeEntryId');

    res.json({ ...invoice.toObject(), lines });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

/**
 * GET /api/invoices
 * Filters: clientId, caseId, status, from, to
 */
export const getAllInvoices = async (req, res) => {
  try {
    const { clientId, caseId, status, from, to } = req.query;
    const filter = {};
    if (clientId) filter.clientId = clientId;
    if (caseId) filter.caseId = caseId;
    if (status) filter.status = status;
    if (from || to) {
      filter.issueDate = {};
      if (from) filter.issueDate.$gte = new Date(from);
      if (to) filter.issueDate.$lte = new Date(to);
    }

    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .populate('clientId caseId createdBy');

    res.json(invoices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

/**
 * POST /api/invoices/from-time
 * Body: { clientId, caseId, timeEntryIds: [] }
 * Generates an invoice from APPROVED TimeEntries, creates InvoiceLine rows, updates TimeEntry.status -> 'billed'.
 */
export const generateFromApprovedTime = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { clientId, caseId, timeEntryIds = [], currency = 'INR', dueDate, periodStart, periodEnd, createdBy } = req.body;

    if (!clientId || !Array.isArray(timeEntryIds) || timeEntryIds.length === 0) {
      return res.status(400).json({ error: 'clientId and timeEntryIds[] are required' });
    }

    const entries = await TimeEntry.find({ _id: { $in: timeEntryIds } }).session(session);
    if (entries.length !== timeEntryIds.length) {
      return res.status(404).json({ error: 'One or more time entries not found' });
    }

    // Validate all entries are approved, belong to the same client/case
    for (const e of entries) {
      if (e.status !== 'approved') {
        await session.abortTransaction();
        return res.status(400).json({ error: 'All time entries must be in approved status' });
      }
      if (String(e.clientId) !== String(clientId)) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'All time entries must match the provided clientId' });
      }
      if (caseId && String(e.caseId) !== String(caseId)) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'All time entries must match the provided caseId' });
      }
    }

    // Create invoice shell
    const invoice = await Invoice.create([{
      clientId,
      caseId: caseId || entries[0].caseId,
      periodStart: periodStart || undefined,
      periodEnd: periodEnd || undefined,
      issueDate: new Date(),
      dueDate: dueDate || undefined,
      currency,
      subtotal: 0,
      tax: 0,
      total: 0,
      status: 'draft',
      createdBy
    }], { session });
    const inv = invoice[0];

    // Create lines
    const linesToInsert = entries.map(e => {
      const qtyHours = Number(((e.billableMinutes || 0) / 60).toFixed(2));
      const rate = Number(e.rateApplied || 0);
      const amount = Number((rate * qtyHours).toFixed(2));
      return {
        invoiceId: inv._id,
        timeEntryId: e._id,
        description: e.narrative || 'Professional services',
        qtyHours,
        rate,
        amount,
      };
    });
    await InvoiceLine.insertMany(linesToInsert, { session });

    // Roll up totals
    const totals = await recalcTotals(inv._id);

    // Mark time entries as billed
    await TimeEntry.updateMany(
      { _id: { $in: timeEntryIds } },
      { $set: { status: 'billed' } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    res.status(201).json({ ...inv.toObject(), ...totals });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(500).json({ error: 'Failed to generate invoice from time' });
  }
};

/**
 * POST /api/invoices/:id/send
 * Body: { dueDate?, pdfUrl? }
 * Sets status -> 'sent'. Optionally updates dueDate/pdfUrl.
 */
export const sendInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { dueDate, pdfUrl } = req.body || {};

    const inv = await Invoice.findById(id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'void') return res.status(400).json({ error: 'Cannot send a void invoice' });

    if (dueDate) inv.dueDate = new Date(dueDate);
    if (pdfUrl) inv.pdfUrl = pdfUrl;
    inv.issueDate = inv.issueDate || new Date();
    inv.status = 'sent';

    await inv.save();
    res.json(inv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
};

/**
 * POST /api/invoices/:id/void
 */
export const voidInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const inv = await Invoice.findById(id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    inv.status = 'void';
    await inv.save();
    res.json(inv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to void invoice' });
  }
};

/**
 * GET /api/invoices/__pipeline
 * Returns totals grouped by status for kanban/pipeline views.
 */
export const getPipeline = async (req, res) => {
  try {
    const { clientId, caseId } = req.query;
    const match = {};
    if (clientId) match.clientId = new mongoose.Types.ObjectId(clientId);
    if (caseId) match.caseId = new mongoose.Types.ObjectId(caseId);

    const agg = [
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: { $ifNull: ['$total', 0] } },
          subtotal: { $sum: { $ifNull: ['$subtotal', 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const rows = await Invoice.aggregate(agg);
    const pipeline = rows.map(r => ({ status: r._id, count: r.count, subtotal: r.subtotal, total: r.total }));
    res.json(pipeline);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to build pipeline' });
  }
};