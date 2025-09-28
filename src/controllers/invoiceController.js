// controllers/invoiceController.js
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Billable from '../models/Billable.js';
import EmailEntry from '../models/EmailEntry.js';
import Case from '../models/Case.js';

/**
 * POST /api/invoices
 * Accepts either:
 *   - { clientId, caseId, billableIds: [...], dueDate?, notes?, currency?, createdBy? }
 *   - { clientId, caseId, emailEntryIds: [...], defaultRate?, dueDate?, notes?, currency?, createdBy? }
 * Computes per-item amount and totalAmount when needed.
 */
export const createInvoice = async (req, res) => {
  try {
    const {
      clientId, caseId, billableIds = [], emailEntryIds = [],
      defaultRate, dueDate, notes, currency = 'USD', createdBy
    } = req.body;

    if (!clientId || !caseId) {
      return res.status(400).json({ error: 'clientId and caseId are required' });
    }

    let items = [];

    if (Array.isArray(billableIds) && billableIds.length) {
      // Strategy A: from Billables
      const billables = await Billable.find({ _id: { $in: billableIds } });
      if (!billables.length) return res.status(422).json({ error: 'No billables found' });

      items = billables.map(b => ({
        billableId: b._id,
        description: b.description,
        durationMinutes: typeof b.durationMinutes === 'number' ? b.durationMinutes : (b.durationHours || 0) * 60,
        rate: b.rate,
        amount: typeof b.amount === 'number'
          ? b.amount
          : Number((((b.rate || 0) * ((b.durationMinutes ?? (b.durationHours || 0) * 60))) / 60).toFixed(2))
      }));
    } else if (Array.isArray(emailEntryIds) && emailEntryIds.length) {
      // Strategy B: from EmailEntries
      const entries = await EmailEntry.find({ _id: { $in: emailEntryIds } });
      if (entries.length !== emailEntryIds.length) {
        return res.status(404).json({ error: 'One or more EmailEntry ids not found' });
      }

      items = entries.map(e => {
        const durationMinutes = e.typingTimeMinutes || 0;
        const rate = typeof e.rate === 'number' ? e.rate : defaultRate;
        const amount = (rate && durationMinutes)
          ? Number(((rate * durationMinutes) / 60).toFixed(2))
          : 0;

        return {
          // billableId omitted intentionally when invoicing email-only items
          description: e.billableSummary || e.subject || `Email with ${e.recipient}`,
          durationMinutes,
          rate,
          amount
        };
      });
    } else {
      return res.status(400).json({ error: 'Provide billableIds[] or emailEntryIds[]' });
    }

    // Compute total
    const totalAmount = Number(items.reduce((s, it) => s + (it.amount || 0), 0).toFixed(2));

    const invoice = await Invoice.create({
      clientId,
      caseId,
      items,
      totalAmount,
      currency,
      dueDate,
      notes,
      createdBy
    });

    return res.status(201).json(invoice);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to create invoice' });
  }
};

export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('clientId caseId items.billableId createdBy');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

/**
 * GET /api/invoices
 * Filters:
 *   - clientId, status
 *   - pending=true (sent/partial/overdue)
 *   - from, to (issueDate range)
 *   - caseType, caseTypeId (filters via Cases)
 */
export const getAllInvoices = async (req, res) => {
  try {
    const { caseType, caseTypeId, clientId, status, from, to, pending } = req.query;

    const filter = {};

    if (clientId) filter.clientId = clientId;

    // pending = any non-void invoice with positive balance
    if (pending === 'true') {
      filter.status = { $in: ['sent', 'partial', 'overdue'] };
    } else if (status) {
      filter.status = status;
    }

    if (from || to) {
      filter.issueDate = {};
      if (from) filter.issueDate.$gte = new Date(from);
      if (to)   filter.issueDate.$lte = new Date(to);
    }

    // Filter by case type (label or id)
    if (caseType || caseTypeId) {
      const q = {};
      if (caseType) q.case_type = caseType.trim();
      if (caseTypeId) {
        if (!mongoose.Types.ObjectId.isValid(caseTypeId)) {
          return res.status(400).json({ error: 'Invalid caseTypeId' });
        }
        q.case_type_id = new mongoose.Types.ObjectId(caseTypeId);
      }
      const caseIds = await Case.find(q).distinct('_id');
      if (!caseIds.length) return res.json([]); // nothing matches
      filter.caseId = { $in: caseIds };
    }

    const invoices = await Invoice.find(filter)
      .populate('clientId caseId items.billableId createdBy')
      .sort({ createdAt: -1 });

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

/**
 * POST /api/invoices/:id/payments
 * Body: { amount, date, method, reference?, receivedBy?, notes? }
 */
export const addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, method, reference, receivedBy, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'amount must be > 0' });
    }
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'void') return res.status(400).json({ error: 'Cannot pay a void invoice' });

    // prevent overpayment
    const newPaidTotal = (invoice.amountPaid || 0) + amount;
    if (newPaidTotal - (invoice.totalAmount || 0) > 0.01) {
      return res.status(400).json({ error: 'Payment exceeds invoice total' });
    }

    invoice.payments.push({ amount, date, method, reference, receivedBy, notes });
    await invoice.save();

    res.json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to add payment' });
  }
};

/**
 * GET /api/invoices/__analytics/pending-by-client
 * Returns totals per client for unpaid/partially paid/overdue invoices.
 */
export const getPendingSummaryByClient = async (_req, res) => {
  try {
    const pipeline = [
      { $match: { status: { $in: ['sent', 'partial', 'overdue'] } } },
      {
        $project: {
          clientId: 1,
          totalAmount: 1,
          amountPaid: 1,
          balance: { $max: [ { $subtract: ['$totalAmount', '$amountPaid'] }, 0 ] }
        }
      },
      {
        $group: {
          _id: '$clientId',
          invoices:   { $sum: 1 },
          totalBilled:{ $sum: '$totalAmount' },
          totalPaid:  { $sum: '$amountPaid' },
          totalDue:   { $sum: '$balance' }
        }
      },
      { $sort: { totalDue: -1 } }
    ];

    const rows = await Invoice.aggregate(pipeline);

    // populate client names
    await Invoice.populate(rows, { path: '_id', model: 'Client', select: 'name' });
    const mapped = rows.map(r => ({
      clientId: r._id?._id || r._id,
      clientName: r._id?.name,
      invoices: r.invoices,
      totalBilled: r.totalBilled,
      totalPaid: r.totalPaid,
      totalDue: r.totalDue
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Failed to build pending summary' });
  }
};

/**
 * (kept for compatibility) GET /api/invoices/user/:userId
 * Returns invoices containing items linked to the user’s billables
 */
export const getInvoicesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // find billables by user, then invoices referencing them
    const billables = await Billable.find({ userId }).distinct('_id');
    if (!billables.length) return res.json([]);

    const invoices = await Invoice.find({ 'items.billableId': { $in: billables } })
      .populate('clientId caseId items.billableId createdBy')
      .sort({ createdAt: -1 });

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoices for user' });
  }
};
