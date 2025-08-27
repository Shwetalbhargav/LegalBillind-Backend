// controllers/invoiceController.js
import Invoice from '../models/Invoice.js';
import Billable from '../models/Billable.js';
import EmailEntry from '../models/EmailEntry.js';

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
      // Strategy A: from Billables (existing behavior)
      const billables = await Billable.find({ _id: { $in: billableIds } });
      if (!billables.length) return res.status(422).json({ error: 'No billables found' });

      items = billables.map(b => ({
        billableId: b._id,
        description: b.description,
        // prefer minutes when present; fall back if your Billable uses hours in some places
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
        const durationMinutes = e.typingTimeMinutes || 0; // from EmailEntry schema
        const rate = typeof e.rate === 'number' ? e.rate : defaultRate; // allow per-entry rate later
        const amount = (rate && durationMinutes)
          ? Number(((rate * durationMinutes) / 60).toFixed(2))
          : 0;

        return {
          // billableId intentionally omitted (your Invoice schema requires it now)
          // If you decide to relax that requirement later, you can add it here.
          description: e.billableSummary || e.subject || `Email with ${e.recipient}`,
          durationMinutes,
          rate,
          amount
        };
      });
    } else {
      return res.status(400).json({ error: 'Provide billableIds[] or emailEntryIds[]' });
    }

    // Compute totalAmount to satisfy schema requirement
    const totalAmount = Number(items.reduce((s, it) => s + (it.amount || 0), 0).toFixed(2));

    const invoice = await Invoice.create({
      clientId,
      caseId,
      items,
      totalAmount,               // required by schema
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

export const getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('clientId caseId items.billableId createdBy')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

export const getInvoicesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const invoices = await Invoice.find({ createdBy: userId })
      .populate('clientId caseId items.billableId createdBy')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoices for user' });
  }
};
