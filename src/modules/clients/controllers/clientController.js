// src/controllers/clientController.js
import { Client } from '../models/Client.js';
import { Case } from '../../cases/models/Case.js';
import { Invoice } from '../../invoices/models/Invoice.js';
import { Payment } from '../../payments/models/Payment.js';
import { TimeEntry } from '../../timeEntries/models/TimeEntry.js';
import { Firm } from '../../firms/models/Firm.js';
import User from '../../users/models/User.js';
import mongoose from 'mongoose';

const toNumber = (v, d = 0) => (v === undefined || v === null || Number.isNaN(Number(v)) ? d : Number(v));
const CLIENT_MUTABLE_FIELDS = ['displayName', 'email', 'phone', 'firmId', 'ownerUserId', 'paymentTerms', 'status'];
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const pickClientPayload = (payload = {}) =>
  CLIENT_MUTABLE_FIELDS.reduce((acc, field) => {
    if (hasOwn(payload, field)) acc[field] = payload[field];
    return acc;
  }, {});

const parsePositiveInt = (value, fallback, max = MAX_LIMIT) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const getPagination = (query = {}) => {
  const page = parsePositiveInt(query.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT);
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const buildMeta = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  totalPages: total ? Math.ceil(total / limit) : 0,
});

const validationFailed = (res, errors) =>
  res.status(400).json({
    ok: false,
    message: 'Validation failed',
    errors,
  });

const validateReferenceIds = async (payload, res) => {
  const errors = [];

  if (hasOwn(payload, 'firmId') && payload.firmId !== null) {
    const firmExists = await Firm.exists({ _id: payload.firmId });
    if (!firmExists) errors.push({ field: 'firmId', message: 'firmId does not reference an existing firm' });
  }

  if (hasOwn(payload, 'ownerUserId') && payload.ownerUserId !== null) {
    const ownerExists = await User.exists({ _id: payload.ownerUserId });
    if (!ownerExists) {
      errors.push({ field: 'ownerUserId', message: 'ownerUserId does not reference an existing user' });
    }
  }

  if (errors.length) {
    validationFailed(res, errors);
    return false;
  }

  return true;
};

const clientExists = async (clientId, res) => {
  const exists = await Client.exists({ _id: clientId });
  if (!exists) {
    res.status(404).json({ ok: false, message: 'Client not found' });
    return false;
  }
  return true;
};

export const getAllClients = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    const requesterId = req.user?.id;
    const requesterRole = String(req.user?.role || '').toLowerCase();

    if (req.query.status) filter.status = req.query.status;
    if (req.query.firmId) filter.firmId = req.query.firmId;
    if (req.query.ownerUserId) filter.ownerUserId = req.query.ownerUserId;
    if (req.query.q) {
      const pattern = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ displayName: pattern }, { email: pattern }, { phone: pattern }];
    }
    if (requesterRole !== 'admin' && requesterId && mongoose.Types.ObjectId.isValid(requesterId)) {
      const assignedCaseClientIds = await Case.find({
        $or: [
          { leadPartnerId: requesterId },
          { managingLawyerId: requesterId },
          { primaryLawyerId: requesterId },
          { assignedUsers: requesterId },
        ],
      }).distinct('clientId');
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { ownerUserId: requesterId },
            { _id: { $in: assignedCaseClientIds } },
          ],
        },
      ];
    }

    const [clients, total] = await Promise.all([
      Client.find(filter)
      .select('displayName email phone paymentTerms ownerUserId createdAt')
      .populate('ownerUserId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
      Client.countDocuments(filter),
    ]);

    res.json({ ok: true, data: clients, meta: buildMeta({ page, limit }, total) });
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
    const payload = pickClientPayload(req.body);
    const refsValid = await validateReferenceIds(payload, res);
    if (!refsValid) return;

    const doc = await Client.create(payload);
    res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const updateClient = async (req, res) => {
  try {
    const payload = pickClientPayload(req.body);
    const refsValid = await validateReferenceIds(payload, res);
    if (!refsValid) return;

    const updated = await Client.findByIdAndUpdate(req.params.clientId, payload, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ ok: false, message: 'Client not found' });
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.clientId).select('_id');
    if (!client) return res.status(404).json({ ok: false, message: 'Client not found' });

    const [caseCount, invoiceDocs, timeEntryCount] = await Promise.all([
      Case.countDocuments({ clientId: req.params.clientId }),
      Invoice.find({ clientId: req.params.clientId }).select('_id'),
      TimeEntry.countDocuments({ clientId: req.params.clientId }),
    ]);
    const invoiceIds = invoiceDocs.map((invoice) => invoice._id);
    const paymentCount = invoiceIds.length
      ? await Payment.countDocuments({ invoiceId: { $in: invoiceIds } })
      : 0;

    if (caseCount || invoiceIds.length || timeEntryCount || paymentCount) {
      return res.status(409).json({
        ok: false,
        message: 'Client has related records and cannot be deleted',
        details: {
          cases: caseCount,
          invoices: invoiceIds.length,
          timeEntries: timeEntryCount,
          payments: paymentCount,
        },
      });
    }

    await Client.findByIdAndDelete(req.params.clientId);
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
    if (hasOwn(req.body, 'ownerUserId')) {
      update.ownerUserId = ownerUserId ? new mongoose.Types.ObjectId(ownerUserId) : null;
    }
    if (hasOwn(req.body, 'paymentTerms')) update.paymentTerms = paymentTerms;

    const refsValid = await validateReferenceIds(update, res);
    if (!refsValid) return;

    const updated = await Client.findByIdAndUpdate(req.params.clientId, update, {
      new: true,
      runValidators: true,
    })
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
    const exists = await clientExists(req.params.clientId, res);
    if (!exists) return;

    const { page, limit, skip } = getPagination(req.query);
    const filter = { clientId: req.params.clientId };
    if (req.query.status) filter.status = req.query.status;

    const [items, total] = await Promise.all([
      Case.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Case.countDocuments(filter),
    ]);

    res.json({ ok: true, data: items, meta: buildMeta({ page, limit }, total) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const listClientInvoices = async (req, res) => {
  try {
    const exists = await clientExists(req.params.clientId, res);
    if (!exists) return;

    const { page, limit, skip } = getPagination(req.query);
    const filter = { clientId: req.params.clientId };
    if (req.query.status) filter.status = req.query.status;

    const [items, total] = await Promise.all([
      Invoice.find(filter).sort({ issueDate: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(filter),
    ]);

    res.json({ ok: true, data: items, meta: buildMeta({ page, limit }, total) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const listClientPayments = async (req, res) => {
  try {
    const exists = await clientExists(req.params.clientId, res);
    if (!exists) return;

    const { page, limit, skip } = getPagination(req.query);
    // payments for client invoices
    const invoices = await Invoice.find({ clientId: req.params.clientId }).select('_id');
    const ids = invoices.map(i => i._id);
    const filter = { invoiceId: { $in: ids } };
    if (req.query.status) filter.status = req.query.status;

    const [items, total] = ids.length
      ? await Promise.all([
        Payment.find(filter).sort({ receivedDate: -1 }).skip(skip).limit(limit),
        Payment.countDocuments(filter),
      ])
      : [[], 0];

    res.json({ ok: true, data: items, meta: buildMeta({ page, limit }, total) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

// -------- client financial summary (WIP/Billed/AR) --------
export const clientSummary = async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const exists = await clientExists(clientId, res);
    if (!exists) return;

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
