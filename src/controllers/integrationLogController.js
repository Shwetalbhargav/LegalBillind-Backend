// src/controllers/integrationLogController.js
import mongoose from 'mongoose';
import IntegrationLog from '../models/IntegrationLog.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v));

// ---- Create (useful for diagnostics & tests) ----
export const createIntegrationLog = async (req, res) => {
  try {
    const doc = await IntegrationLog.create(req.body);
    res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

// ---- Read / list with filters ----
export const listIntegrationLogs = async (req, res) => {
  try {
    const {
      platform, status, billableId, invoiceId, from, to,
      limit = 100, skip = 0
    } = req.query;

    const q = {};
    if (platform) q.platform = platform;
    if (status) q.status = status;
    if (isId(billableId)) q.billableId = billableId;
    if (isId(invoiceId)) q.invoiceId = invoiceId;
    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(from);
      if (to) q.createdAt.$lte = new Date(to);
    }

    const [items, total] = await Promise.all([
      IntegrationLog.find(q).sort({ createdAt: -1 }).skip(Number(skip)).limit(Math.min(Number(limit), 500)),
      IntegrationLog.countDocuments(q)
    ]);

    res.json({ ok: true, data: items, meta: { total, limit: Number(limit), skip: Number(skip) } });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch logs' });
  }
};

export const getIntegrationLogById = async (req, res) => {
  try {
    const doc = await IntegrationLog.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, message: 'Log not found' });
    res.json({ ok: true, data: doc });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch log' });
  }
};

// ---- Convenience entity views ----
export const listLogsByBillable = async (req, res) => {
  try {
    const { billableId } = req.params;
    if (!isId(billableId)) return res.status(400).json({ ok: false, message: 'Invalid billableId' });
    const items = await IntegrationLog.find({ billableId }).sort({ createdAt: -1 });
    res.json({ ok: true, data: items });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch logs' });
  }
};

export const listLogsByInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    if (!isId(invoiceId)) return res.status(400).json({ ok: false, message: 'Invalid invoiceId' });
    const items = await IntegrationLog.find({ invoiceId }).sort({ createdAt: -1 });
    res.json({ ok: true, data: items });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch logs' });
  }
};

// ---- Stats / aggregates ----
export const logStats = async (req, res) => {
  try {
    const { from, to, groupBy = 'platform' } = req.query;
    const match = {};
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    const groupField = groupBy === 'status' ? '$status' : '$platform';
    const rows = await IntegrationLog.aggregate([
      { $match: match },
      { $group: { _id: groupField, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to compute stats' });
  }
};

// ---- Delete (single & bulk by filter) ----
export const deleteIntegrationLog = async (req, res) => {
  try {
    const del = await IntegrationLog.findByIdAndDelete(req.params.id);
    if (!del) return res.status(404).json({ ok: false, message: 'Log not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to delete log' });
  }
};

export const purgeIntegrationLogs = async (req, res) => {
  try {
    const { platform, status, before } = req.body || {};
    const q = {};
    if (platform) q.platform = platform;
    if (status) q.status = status;
    if (before) q.createdAt = { $lt: new Date(before) };
    const { deletedCount } = await IntegrationLog.deleteMany(q);
    res.json({ ok: true, deletedCount });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};
