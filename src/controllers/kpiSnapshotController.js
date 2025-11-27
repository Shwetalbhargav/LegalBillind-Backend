// src/controllers/kpiSnapshotController.js
import mongoose from 'mongoose';
import { KpiSnapshot } from '../models/KpiSnapshot.js';
import { TimeEntry } from '../models/TimeEntry.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';

function monthRange(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 0, 0, 0));
  return { start, end };
}

/**
 * Internal helper: compute KPIs and upsert snapshot.
 * NOT an Express handler.
 */
async function computeAndUpsertCore(scope, scopeId, month) {
  const { start, end } = monthRange(month);

  // Utilization
  const utilAgg = await TimeEntry.aggregate([
    {
      $match: {
        date: { $gte: start, $lt: end },
        ...(scopeId ? { [`${scope}Id`]: new mongoose.Types.ObjectId(scopeId) } : {}),
      },
    },
    {
      $group: {
        _id: null,
        b: { $sum: { $ifNull: ['$billableMinutes', 0] } },
        n: { $sum: { $ifNull: ['$nonbillableMinutes', 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        util: {
          $cond: [
            { $gt: [{ $add: ['$b', '$n'] }, 0] },
            { $divide: ['$b', { $add: ['$b', '$n'] }] },
            0,
          ],
        },
      },
    },
  ]);
  const utilization = utilAgg[0]?.util || 0;

  // WIP
  const wipAgg = await TimeEntry.aggregate([
    {
      $match: {
        status: { $in: ['submitted', 'approved'] },
        date: { $lt: end },
        ...(scopeId ? { [`${scope}Id`]: new mongoose.Types.ObjectId(scopeId) } : {}),
      },
    },
    { $group: { _id: null, w: { $sum: { $ifNull: ['$amount', 0] } } } },
  ]);
  const WIP = wipAgg[0]?.w || 0;

  // Invoiced (period)
  let invoiced = 0;
  if (scope === 'user') {
    const a = await Invoice.aggregate([
      { $match: { issueDate: { $gte: start, $lt: end }, status: { $ne: 'void' } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'timeentries',
          localField: 'items.billableId',
          foreignField: '_id',
          as: 'te',
        },
      },
      { $unwind: '$te' },
      { $match: { 'te.userId': new mongoose.Types.ObjectId(scopeId) } },
      { $group: { _id: '$_id', amt: { $sum: { $ifNull: ['$items.amount', 0] } } } },
      { $group: { _id: null, total: { $sum: '$amt' } } },
    ]);
    invoiced = a[0]?.total || 0;
  } else {
    const m = { issueDate: { $gte: start, $lt: end }, status: { $ne: 'void' } };
    if (scopeId && (scope === 'client' || scope === 'case')) {
      m[`${scope}Id`] = new mongoose.Types.ObjectId(scopeId);
    }
    const a = await Invoice.aggregate([
      { $match: m },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$total', 0] } } } },
    ]);
    invoiced = a[0]?.total || 0;
  }

  // Revenue (payments period)
  let revenue = 0;
  if (scope === 'firm' || !scopeId) {
    const p = await Payment.aggregate([
      { $match: { status: 'cleared', receivedDate: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    revenue = p[0]?.total || 0;
  } else if (scope === 'client' || scope === 'case') {
    const matchInvoice = {};
    matchInvoice[`${scope}Id`] = new mongoose.Types.ObjectId(scopeId);
    const p = await Payment.aggregate([
      { $match: { status: 'cleared', receivedDate: { $gte: start, $lt: end } } },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoiceId',
          foreignField: '_id',
          as: 'inv',
        },
      },
      { $unwind: '$inv' },
      { $match: matchInvoice },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    revenue = p[0]?.total || 0;
  } else if (scope === 'user') {
    const userId = new mongoose.Types.ObjectId(scopeId);
    const p = await Payment.aggregate([
      { $match: { status: 'cleared', receivedDate: { $gte: start, $lt: end } } },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoiceId',
          foreignField: '_id',
          as: 'inv',
        },
      },
      { $unwind: '$inv' },
      { $unwind: '$inv.items' },
      {
        $lookup: {
          from: 'timeentries',
          localField: 'inv.items.billableId',
          foreignField: '_id',
          as: 'te',
        },
      },
      { $unwind: '$te' },
      {
        $group: {
          _id: { invoiceId: '$inv._id', userId: '$te.userId', paymentId: '$_id' },
          itemAmt: { $sum: { $ifNull: ['$inv.items.amount', 0] } },
          paymentAmount: { $first: '$amount' },
        },
      },
      {
        $group: {
          _id: { invoiceId: '$_id.invoiceId', paymentId: '$_id.paymentId' },
          byUser: { $push: { userId: '$_id.userId', itemAmt: '$itemAmt' } },
          totalItems: { $sum: '$itemAmt' },
          paymentAmount: { $first: '$paymentAmount' },
        },
      },
      {
        $project: {
          allocations: {
            $map: {
              input: '$byUser',
              as: 'u',
              in: {
                userId: '$$u.userId',
                share: {
                  $cond: [
                    { $gt: ['$totalItems', 0] },
                    { $multiply: ['$$u.itemAmt', { $divide: ['$paymentAmount', '$totalItems'] }] },
                    0,
                  ],
                },
              },
            },
          },
        },
      },
      { $unwind: '$allocations' },
      { $match: { 'allocations.userId': userId } },
      { $group: { _id: null, total: { $sum: '$allocations.share' } } },
    ]);
    revenue = p[0]?.total || 0;
  }

  // AR (as of end)
  let invSum = 0;
  if (scope === 'user') {
    const a = await Invoice.aggregate([
      { $match: { issueDate: { $lt: end }, status: { $ne: 'void' } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'timeentries',
          localField: 'items.billableId',
          foreignField: '_id',
          as: 'te',
        },
      },
      { $unwind: '$te' },
      { $match: { 'te.userId': new mongoose.Types.ObjectId(scopeId) } },
      { $group: { _id: '$_id', amt: { $sum: { $ifNull: ['$items.amount', 0] } } } },
      { $group: { _id: null, total: { $sum: '$amt' } } },
    ]);
    invSum = a[0]?.total || 0;
  } else {
    const m = { issueDate: { $lt: end }, status: { $ne: 'void' } };
    if (scopeId && (scope === 'client' || scope === 'case')) {
      m[`${scope}Id`] = new mongoose.Types.ObjectId(scopeId);
    }
    const a = await Invoice.aggregate([
      { $match: m },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$total', 0] } } } },
    ]);
    invSum = a[0]?.total || 0;
  }

  let paySum = 0;
  if (scope === 'firm' || !scopeId) {
    const p = await Payment.aggregate([
      { $match: { status: 'cleared', receivedDate: { $lt: end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    paySum = p[0]?.total || 0;
  } else if (scope === 'client' || scope === 'case') {
    const m = {};
    m[`${scope}Id`] = new mongoose.Types.ObjectId(scopeId);
    const p = await Payment.aggregate([
      { $match: { status: 'cleared', receivedDate: { $lt: end } } },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoiceId',
          foreignField: '_id',
          as: 'inv',
        },
      },
      { $unwind: '$inv' },
      { $match: m },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    paySum = p[0]?.total || 0;
  } else if (scope === 'user') {
    const userId = new mongoose.Types.ObjectId(scopeId);
    const p = await Payment.aggregate([
      { $match: { status: 'cleared', receivedDate: { $lt: end } } },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoiceId',
          foreignField: '_id',
          as: 'inv',
        },
      },
      { $unwind: '$inv' },
      { $unwind: '$inv.items' },
      {
        $lookup: {
          from: 'timeentries',
          localField: 'inv.items.billableId',
          foreignField: '_id',
          as: 'te',
        },
      },
      { $unwind: '$te' },
      {
        $group: {
          _id: { invoiceId: '$inv._id', userId: '$te.userId', paymentId: '$_id' },
          itemAmt: { $sum: { $ifNull: ['$inv.items.amount', 0] } },
          paymentAmount: { $first: '$amount' },
        },
      },
      {
        $group: {
          _id: { invoiceId: '$_id.invoiceId', paymentId: '$_id.paymentId' },
          byUser: { $push: { userId: '$_id.userId', itemAmt: '$itemAmt' } },
          totalItems: { $sum: '$itemAmt' },
          paymentAmount: { $first: '$paymentAmount' },
        },
      },
      {
        $project: {
          allocations: {
            $map: {
              input: '$byUser',
              as: 'u',
              in: {
                userId: '$$u.userId',
                share: {
                  $cond: [
                    { $gt: ['$totalItems', 0] },
                    { $multiply: ['$$u.itemAmt', { $divide: ['$paymentAmount', '$totalItems'] }] },
                    0,
                  ],
                },
              },
            },
          },
        },
      },
      { $unwind: '$allocations' },
      { $match: { 'allocations.userId': userId } },
      { $group: { _id: null, total: { $sum: '$allocations.share' } } },
    ]);
    paySum = p[0]?.total || 0;
  }

  const AR = Math.max(0, Number((invSum - paySum).toFixed(2)));
  const realization = invoiced > 0 ? revenue / invoiced : 0;

  await KpiSnapshot.updateOne(
    { scope, scopeId: scopeId ? new mongoose.Types.ObjectId(scopeId) : null, month },
    { $set: { utilization, realization, WIP, AR, revenue } },
    { upsert: true }
  );

  return { scope, scopeId, month, utilization, realization, WIP, AR, revenue };
}

/**
 * POST /api/kpi-snapshots/compute-upsert
 * Body: { scope: "firm" | "user" | "client" | "case", scopeId?: string, month?: "YYYY-MM" }
 */
export const computeAndUpsert = async (req, res) => {
  try {
    const { scope, scopeId, month } = req.body || {};
    if (!scope) {
      return res.status(400).json({ error: 'scope is required' });
    }
    const m = month || new Date().toISOString().slice(0, 7); // default current month
    const result = await computeAndUpsertCore(scope, scopeId || null, m);
    res.json(result);
  } catch (err) {
    console.error('computeAndUpsert error:', err);
    res.status(500).json({ error: 'Failed to compute and upsert KPI snapshot' });
  }
};

/**
 * POST /api/kpi-snapshots/generate
 * Body: { month: "YYYY-MM", scopes?: ["firm","user","client","case"], scopeIds?: string[] }
 */
export const generateSnapshots = async (req, res) => {
  try {
    const month = req.body.month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const scopes =
      Array.isArray(req.body.scopes) && req.body.scopes.length
        ? req.body.scopes
        : ['firm'];
    const scopeIds = Array.isArray(req.body.scopeIds) ? req.body.scopeIds : [];

    const results = [];
    for (const s of scopes) {
      if (s === 'firm') {
        results.push(await computeAndUpsertCore('firm', null, month));
      } else if (scopeIds.length) {
        for (const id of scopeIds) {
          results.push(await computeAndUpsertCore(s, id, month));
        }
      } else {
        // Auto-discover distinct IDs from data within the month range
        const { start, end } = monthRange(month);
        const model = s === 'user' ? TimeEntry : Invoice;
        const distinctField = s === 'user' ? 'userId' : s === 'client' ? 'clientId' : 'caseId';
        const baseMatch =
          s === 'user'
            ? { date: { $gte: start, $lt: end } }
            : { issueDate: { $lt: end }, status: { $ne: 'void' } };

        const ids = await model.distinct(distinctField, baseMatch);
        for (const id of ids) {
          results.push(await computeAndUpsertCore(s, id, month));
        }
      }
    }

    res.json({ month, generated: results.length, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate KPI snapshots' });
  }
};

/**
 * GET /api/kpi-snapshots
 * Query: month?, scope?, scopeId?
 */
export const listSnapshots = async (req, res) => {
  try {
    const q = {};
    if (req.query.month) q.month = req.query.month;
    if (req.query.scope) q.scope = req.query.scope;
    if (req.query.scopeId) q.scopeId = new mongoose.Types.ObjectId(req.query.scopeId);
    const docs = await KpiSnapshot.find(q).sort({ month: -1, scope: 1 });
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list KPI snapshots' });
  }
};

/**
 * GET /api/kpi-snapshots/:id
 */
export const getSnapshotById = async (req, res) => {
  try {
    const doc = await KpiSnapshot.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Snapshot not found' });
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch snapshot' });
  }
};
