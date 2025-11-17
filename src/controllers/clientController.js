// src/controllers/clientController.js
import { Client } from '../models/Client.js';
import { Case } from '../models/Case.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { TimeEntry } from '../models/TimeEntry.js';
import mongoose from 'mongoose';

const toNumber = (v, d = 0) => (v === undefined || v === null || Number.isNaN(Number(v)) ? d : Number(v));

export const getAllClients = async (_req, res) => {
  try {
    const clients = await Client.find()
      .select('displayName email phone paymentTerms ownerUserId createdAt')
      .populate('ownerUserId', 'name email');
    res.json({ ok: true, data: clients });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch clients' });
  }
};

export const getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.clientId)
      .populate('ownerUserId', 'name email');
    if (!client) return res.status(404).json({ ok: false, message: 'Client not found' });
    res.json({ ok: true, data: client });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch client' });
  }
};

export const createClient = async (req, res) => {
  try {
    const doc = await Client.create(req.body);
    res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const updateClient = async (req, res) => {
  try {
    const updated = await Client.findByIdAndUpdate(req.params.clientId, req.body, { new: true });
    if (!updated) return res.status(404).json({ ok: false, message: 'Client not found' });
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const deleteClient = async (req, res) => {
  try {
    const deleted = await Client.findByIdAndDelete(req.params.clientId);
    if (!deleted) return res.status(404).json({ ok: false, message: 'Client not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to delete client' });
  }
};

// -------- owner mapping / payment terms --------
export const assignOwner = async (req, res) => {
  try {
    const { ownerUserId, paymentTerms } = req.body; // either or both
    const update = {};
    if (ownerUserId) update.ownerUserId = new mongoose.Types.ObjectId(ownerUserId);
    if (paymentTerms) update.paymentTerms = paymentTerms;

    const updated = await Client.findByIdAndUpdate(req.params.clientId, update, { new: true })
      .populate('ownerUserId', 'name email');

    if (!updated) return res.status(404).json({ ok: false, message: 'Client not found' });
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

// -------- related lists --------
export const listClientCases = async (req, res) => {
  try {
    const items = await Case.find({ clientId: req.params.clientId }).sort({ createdAt: -1 });
    res.json({ ok: true, data: items });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const listClientInvoices = async (req, res) => {
  try {
    const items = await Invoice.find({ clientId: req.params.clientId }).sort({ issueDate: -1 });
    res.json({ ok: true, data: items });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const listClientPayments = async (req, res) => {
  try {
    // payments for client invoices
    const invoices = await Invoice.find({ clientId: req.params.clientId }).select('_id');
    const ids = invoices.map(i => i._id);
    const items = ids.length ? await Payment.find({ invoiceId: { $in: ids } }).sort({ receivedDate: -1 }) : [];
    res.json({ ok: true, data: items });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

// -------- client financial summary (WIP/Billed/AR) --------
export const clientSummary = async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const clearedOnly = req.query.clearedOnly !== 'false';

    // WIP: unbilled hours for all client cases (heuristic: submitted|approved)
    const wipEntries = await TimeEntry.find({
      clientId,
      status: { $in: ['submitted', 'approved'] }
    }).select('billableMinutes rateApplied amount');

    const wip = wipEntries.reduce((sum, te) => {
      const minutes = toNumber(te.billableMinutes, 0);
      const rate = toNumber(te.rateApplied, 0);
      const amt = typeof te.amount === 'number' ? te.amount : rate * (minutes / 60);
      return sum + amt;
    }, 0);

    // Billed & payments
    const invoices = await Invoice.find({
      clientId,
      status: { $in: ['draft', 'sent', 'partial', 'paid', 'overdue'] }
    }).select('total');

    const billed = invoices.reduce((s, i) => s + toNumber(i.total, 0), 0);

    const ids = invoices.map(i => i._id);
    let pQuery = { invoiceId: { $in: ids } };
    if (clearedOnly) pQuery.status = 'cleared';

    const payments = ids.length ? await Payment.find(pQuery).select('amount') : [];
    const paid = payments.reduce((s, p) => s + toNumber(p.amount, 0), 0);

    const ar = Math.max(0, billed - paid);

    res.json({
      ok: true,
      data: {
        clientId,
        wip: +wip.toFixed(2),
        billed: +billed.toFixed(2),
        paid: +paid.toFixed(2),
        ar: +ar.toFixed(2),
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to compute client summary' });
  }
};
