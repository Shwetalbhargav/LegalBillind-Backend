// src/controllers/caseController.js
import mongoose from 'mongoose';
import { Case } from '../models/Case.js';
import { TimeEntry } from '../models/TimeEntry.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';

// ---------- helpers ----------
const asObjectId = (id) => {
  try { return new mongoose.Types.ObjectId(id); } catch { return null; }
};
const toNumber = (v, d = 0) => (v === undefined || v === null || Number.isNaN(Number(v)) ? d : Number(v));

// Compute amount for a time entry if not stored
const computeTimeAmount = (te) => {
  if (typeof te.amount === 'number') return te.amount;
  const minutes = toNumber(te.billableMinutes, 0);
  const rate = toNumber(te.rateApplied, 0);
  return +(rate * (minutes / 60)).toFixed(2);
};

// ---------- CRUD ----------
export const createCase = async (req, res) => {
  try {
    const doc = await Case.create(req.body);
    res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const getAllCases = async (req, res) => {
  try {
    const q = {};
    if (req.query.clientId) q.clientId = req.query.clientId;
    if (req.query.status) q.status = req.query.status;

    const items = await Case.find(q)
      .populate('clientId', 'displayName')
      .populate('assignedUsers', 'name role')
      .populate('primaryLawyerId', 'name');
    res.json({ ok: true, data: items });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch cases' });
  }
};

export const getCaseById = async (req, res) => {
  try {
    const doc = await Case.findById(req.params.caseId)
      .populate('clientId', 'displayName')
      .populate('assignedUsers', 'name role')
      .populate('primaryLawyerId', 'name');
    if (!doc) return res.status(404).json({ ok: false, message: 'Case not found' });
    res.json({ ok: true, data: doc });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch case' });
  }
};

export const updateCase = async (req, res) => {
  try {
    const updated = await Case.findByIdAndUpdate(req.params.caseId, req.body, { new: true });
    if (!updated) return res.status(404).json({ ok: false, message: 'Case not found' });
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const deleteCase = async (req, res) => {
  try {
    const deleted = await Case.findByIdAndDelete(req.params.caseId);
    if (!deleted) return res.status(404).json({ ok: false, message: 'Case not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to delete case' });
  }
};

// ---------- status transition ----------
export const transitionStatus = async (req, res) => {
  try {
    const { status, closedAt } = req.body; // status in ['open','closed','pending','archived']
    if (!status) return res.status(400).json({ ok: false, message: 'status is required' });

    const update = { status };
    if (status === 'closed' && !closedAt) update.closedAt = new Date();
    if (closedAt) update.closedAt = new Date(closedAt);

    const updated = await Case.findByIdAndUpdate(req.params.caseId, update, { new: true });
    if (!updated) return res.status(404).json({ ok: false, message: 'Case not found' });
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

// ---------- related lists ----------
export const listCaseTimeEntries = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const q = { caseId: req.params.caseId };

    const [items, total] = await Promise.all([
      TimeEntry.find(q).sort({ date: -1 }).skip(skip).limit(Number(limit)),
      TimeEntry.countDocuments(q),
    ]);
    res.json({ ok: true, data: items, meta: { page: Number(page), limit: Number(limit), total } });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const listCaseInvoices = async (req, res) => {
  try {
    const items = await Invoice.find({ caseId: req.params.caseId }).sort({ issueDate: -1 });
    res.json({ ok: true, data: items });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const listCasePayments = async (req, res) => {
  try {
    // Find payments for all invoices of this case
    const invoices = await Invoice.find({ caseId: req.params.caseId }).select('_id');
    const invoiceIds = invoices.map(i => i._id);
    const items = invoiceIds.length
      ? await Payment.find({ invoiceId: { $in: invoiceIds } }).sort({ receivedDate: -1 })
      : [];
    res.json({ ok: true, data: items });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

// ---------- financial rollup (WIP / Billed / AR) ----------
export const caseRollup = async (req, res) => {
  try {
    const caseId = asObjectId(req.params.caseId);
    if (!caseId) return res.status(400).json({ ok: false, message: 'Invalid caseId' });

    const clearedOnly = req.query.clearedOnly !== 'false'; // default true

    // WIP: time entries not yet billed/paid (heuristic: status in submitted|approved)
    const wipEntries = await TimeEntry.find({
      caseId,
      status: { $in: ['submitted', 'approved'] }
    }).select('billableMinutes rateApplied amount');

    const wip = wipEntries.reduce((sum, te) => sum + computeTimeAmount(te), 0);

    // Billed: sum of invoice totals for this case (excluding void)
    const invoices = await Invoice.find({
      caseId,
      status: { $in: ['draft', 'sent', 'partial', 'paid', 'overdue'] }
    }).select('total');

    const billed = invoices.reduce((s, i) => s + toNumber(i.total, 0), 0);

    // Payments against those invoices
    const invoiceIds = invoices.map(i => i._id);
    let payQuery = { invoiceId: { $in: invoiceIds } };
    if (clearedOnly) payQuery.status = 'cleared';

    const payments = invoiceIds.length
      ? await Payment.find(payQuery).select('amount')
      : [];
    const paid = payments.reduce((s, p) => s + toNumber(p.amount, 0), 0);

    const ar = Math.max(0, billed - paid);

    res.json({
      ok: true,
      data: {
        caseId,
        wip: +wip.toFixed(2),
        billed: +billed.toFixed(2),
        paid: +paid.toFixed(2),
        ar: +ar.toFixed(2),
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to compute rollup' });
  }
};

// ---------- utility ----------
export const getCasesByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const cases = await Case.find({ clientId }).sort({ createdAt: -1 });
    res.json({ ok: true, data: cases });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};
