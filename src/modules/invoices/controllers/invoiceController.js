// src/controllers/invoiceController.js
import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.js';
import { InvoiceLine } from '../models/InvoiceLine.js';
import { TimeEntry } from '../../timeEntries/models/TimeEntry.js';
import Billable from '../../billables/models/Billable.js';
import { EmailEntry } from '../../emailEntries/models/EmailEntry.js';
import { buildInvoiceHtml, buildInvoicePdfBuffer, emailInvoice } from '../services/invoiceDeliveryService.js';
import { recalcInvoiceTotals } from '../services/invoiceTotalsService.js';

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
 * Filters: clientId, caseId, status, userId, from, to
 */
export const getAllInvoices = async (req, res) => {
  try {
    const { clientId, caseId, status, userId, from, to } = req.query;
    const filter = {};
    if (clientId) filter.clientId = clientId;
    if (caseId) filter.caseId = caseId;
    if (userId) filter.createdBy = userId;
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
      await session.abortTransaction();
      session.endSession();
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
      const qtyHours = Number(((e.billableMinutes || 0) / 60).toFixed(4));
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
    const totals = await recalcInvoiceTotals(inv._id, { session });

    // Mark time entries as billed
    await TimeEntry.updateMany(
      { _id: { $in: timeEntryIds } },
      { $set: { status: 'billed' } },
      { session }
    );
    await EmailEntry.updateMany(
      { 'meta.timeEntryId': { $in: timeEntryIds } },
      { $set: { status: 'billed', billedAt: new Date() } },
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
 * POST /api/invoices/from-billables
 * Body: { clientId, caseId?, billableIds: [] }
 * Generates a draft invoice from APPROVED Billables and marks them billed.
 */
export const generateFromApprovedBillables = async (req, res) => {
  const { clientId, caseId, billableIds = [], currency = 'INR', dueDate, periodStart, periodEnd, createdBy } = req.body;

  if (!clientId || !Array.isArray(billableIds) || billableIds.length === 0) {
    return res.status(400).json({ error: 'clientId and billableIds[] are required' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const billables = await Billable.find({ _id: { $in: billableIds } }).session(session);
    if (billables.length !== billableIds.length) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'One or more billables not found' });
    }

    for (const billable of billables) {
      if (billable.status !== 'approved') {
        await session.abortTransaction();
        return res.status(400).json({ error: 'All billables must be approved before invoicing' });
      }
      if (billable.invoiceId || billable.status === 'billed') {
        await session.abortTransaction();
        return res.status(409).json({ error: 'One or more billables are already billed' });
      }
      if (String(billable.clientId) !== String(clientId)) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'All billables must match the provided clientId' });
      }
      if (caseId && String(billable.caseId) !== String(caseId)) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'All billables must match the provided caseId' });
      }
    }

    const uniqueCaseIds = [...new Set(billables.map((billable) => String(billable.caseId)))];
    const invoiceCaseId = caseId || (uniqueCaseIds.length === 1 ? uniqueCaseIds[0] : undefined);
    const items = billables.map((billable) => {
      const durationMinutes = Number(billable.durationMinutes || 0);
      const rate = Number(billable.rate || 0);
      const amount = Number(
        (billable.amount != null ? billable.amount : rate * (durationMinutes / 60)).toFixed(2)
      );

      return {
        billableId: billable._id,
        description: billable.description || billable.category || 'Professional services',
        durationMinutes,
        rate,
        amount,
      };
    });

    const [invoice] = await Invoice.create([{
      clientId,
      caseId: invoiceCaseId,
      periodStart: periodStart || undefined,
      periodEnd: periodEnd || undefined,
      issueDate: new Date(),
      dueDate: dueDate || undefined,
      currency,
      status: 'draft',
      createdBy: createdBy || req.user?.id,
      items,
    }], { session });

    await InvoiceLine.insertMany(items.map((item) => ({
      invoiceId: invoice._id,
      billableId: item.billableId,
      description: item.description,
      qtyHours: Number(((item.durationMinutes || 0) / 60).toFixed(4)),
      rate: item.rate,
      amount: item.amount,
    })), { session });

    const totals = await recalcInvoiceTotals(invoice._id, { session });

    await Billable.updateMany(
      { _id: { $in: billableIds } },
      {
        $set: {
          status: 'billed',
          invoiceId: invoice._id,
          pushedAt: new Date(),
        },
      },
      { session }
    );
    await EmailEntry.updateMany(
      { 'meta.billableId': { $in: billableIds } },
      { $set: { status: 'billed', billedAt: new Date() } },
      { session }
    );

    await session.commitTransaction();
    res.status(201).json({ ...invoice.toObject(), ...totals });
  } catch (error) {
    await session.abortTransaction();
    console.error(error);
    res.status(500).json({ error: 'Failed to generate invoice from billables' });
  } finally {
    session.endSession();
  }
};

/**
 * POST /api/invoices/:id/send
 * Body: { dueDate?, pdfUrl?, to?, subject?, message? }
 * Sends a PDF invoice by email when a recipient is present and sets status -> 'sent'.
 */
export const sendInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { dueDate, pdfUrl, to, subject, message } = req.body || {};

    const inv = await Invoice.findById(id).populate('clientId caseId createdBy');
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'void') return res.status(400).json({ error: 'Cannot send a void invoice' });

    await recalcInvoiceTotals(inv._id);
    const refreshed = await Invoice.findById(id).populate('clientId caseId createdBy');
    if (dueDate) refreshed.dueDate = new Date(dueDate);
    if (pdfUrl) refreshed.pdfUrl = pdfUrl;
    refreshed.issueDate = refreshed.issueDate || new Date();
    refreshed.status = 'sent';
    refreshed.sentAt = new Date();
    refreshed.deliveryStatus = 'sent';

    let delivery = null;
    try {
      delivery = await emailInvoice(refreshed, { to, subject, message });
      refreshed.sentTo = delivery.to;
      refreshed.deliveryError = undefined;
    } catch (deliveryError) {
      refreshed.deliveryStatus = 'failed';
      refreshed.deliveryError = deliveryError.message;
    }

    await refreshed.save();
    res.json({ ...refreshed.toObject(), delivery });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
};

export const downloadInvoicePdf = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('clientId caseId createdBy');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    await recalcInvoiceTotals(invoice._id);
    const refreshed = await Invoice.findById(req.params.id).populate('clientId caseId createdBy');
    const pdf = await buildInvoicePdfBuffer(refreshed);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${refreshed.invoiceNumber || refreshed._id}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
};

export const previewInvoiceHtml = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('clientId caseId createdBy');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    await recalcInvoiceTotals(invoice._id);
    const refreshed = await Invoice.findById(req.params.id).populate('clientId caseId createdBy');
    const html = await buildInvoiceHtml(refreshed);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to render invoice document' });
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

// GET /api/invoices/__analytics/pending-by-client
// Summarize total pending amount per client.
// "Pending" = invoices that are NOT paid or void.
export const getPendingSummaryByClient = async (req, res) => {
  try {
    const { clientId } = req.query;

    const match = {
      status: { $nin: ["paid", "void"] }, // treat all other statuses as pending
    };

    if (clientId) {
      match.clientId = new mongoose.Types.ObjectId(clientId);
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: "$clientId",
          // support either total or totalAmount fields
          totalPending: {
            $sum: {
              $ifNull: ["$total", "$totalAmount"],
            },
          },
          invoiceCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "clients",
          localField: "_id",
          foreignField: "_id",
          as: "client",
        },
      },
      { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          clientId: "$_id",
          clientName: {
            $ifNull: [
              "$client.displayName",
              {
                $ifNull: ["$client.name", "Unknown client"],
              },
            ],
          },
          totalPending: 1,
          invoiceCount: 1,
        },
      },
      { $sort: { totalPending: -1 } },
    ];

    const rows = await Invoice.aggregate(pipeline);
    // Frontend handles both {items: []} and [] so this is safe:
    res.json({ items: rows });
  } catch (error) {
    console.error("getPendingSummaryByClient error", error);
    res
      .status(500)
      .json({ error: "Failed to compute pending summary by client" });
  }
};
