// src/controllers/kpiController.js
import mongoose from 'mongoose';
import { TimeEntry } from '../models/TimeEntry.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';

/**
 * Helpers
 */
function toDateRange({ from, to, month }) {
  if (month) {
    // month in "YYYY-MM"
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 0, 0, 0));
    return { start, end };
  }
  const start = from ? new Date(from) : new Date('1970-01-01T00:00:00Z');
  const end = to ? new Date(to) : new Date('2999-12-31T00:00:00Z');
  return { start, end };
}

function normalizeScope(scope = 'firm') {
  if (!['firm', 'user', 'client', 'case'].includes(scope)) return 'firm';
  return scope;
}

function scopeFilters(scope, scopeId) {
  const f = {};
  if (!scopeId) return f;
  switch (scope) {
    case 'user': f.userId = new mongoose.Types.ObjectId(scopeId); break;
    case 'client': f.clientId = new mongoose.Types.ObjectId(scopeId); break;
    case 'case': f.caseId = new mongoose.Types.ObjectId(scopeId); break;
  }
  return f;
}

/**
 * Compute core KPIs for the given scope and date range.
 * - revenue: sum(Payment.amount) cleared in range (apportioned by scope)
 * - WIP: sum(TimeEntry.amount) where status ∈ {submitted, approved}
 * - AR: sum(Invoice.total) - sum(Payment.amount) for invoices issued <= end
 * - utilization: billableMinutes / (billableMinutes + nonbillableMinutes)
 * - realization: revenue / invoiced (for invoices issued in range)
 */
export const getKpiSummary = async (req, res) => {
  try {
    const scope = normalizeScope(req.query.scope);
    const scopeId = req.query.scopeId || null;
    const { start, end } = toDateRange(req.query);

    // ---------- UTILIZATION ----------
    const teMatch = {
      date: { $gte: start, $lt: end },
      ...scopeFilters(scope, scopeId),
    };
    const utilAgg = await TimeEntry.aggregate([
      { $match: teMatch },
      {
        $group: {
          _id: null,
          billable: { $sum: { $ifNull: ['$billableMinutes', 0] } },
          nonbillable: { $sum: { $ifNull: ['$nonbillableMinutes', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          billable: 1,
          nonbillable: 1,
          utilization: {
            $cond: [
              { $gt: [{ $add: ['$billable', '$nonbillable'] }, 0] },
              { $divide: ['$billable', { $add: ['$billable', '$nonbillable'] }] },
              0,
            ],
          },
        },
      },
    ]);

    const utilization = utilAgg[0]?.utilization || 0;

    // ---------- WIP ----------
    const wipAgg = await TimeEntry.aggregate([
      {
        $match: {
          ...scopeFilters(scope, scopeId),
          status: { $in: ['submitted', 'approved'] },
          date: { $lt: end }, // anything not yet billed by end of period
        },
      },
      { $group: { _id: null, WIP: { $sum: { $ifNull: ['$amount', 0] } } } },
    ]);
    const WIP = wipAgg[0]?.WIP || 0;

    // ---------- INVOICED (period) ----------
    const invMatchPeriod = {
      issueDate: { $gte: start, $lt: end },
      status: { $ne: 'void' },
    };
    // Filter by scope for invoices: client & case are direct; user requires join via items -> TimeEntry.userId
    if (scope === 'client') invMatchPeriod.clientId = new mongoose.Types.ObjectId(scopeId);
    if (scope === 'case') invMatchPeriod.caseId = new mongoose.Types.ObjectId(scopeId);

    let invoicedTotal = 0;
    if (scope === 'user' && scopeId) {
      const invUserAgg = await Invoice.aggregate([
        { $match: invMatchPeriod },
        { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
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
        { $group: { _id: '$_id', amount: { $sum: { $ifNull: ['$items.amount', 0] } } } },
        { $group: { _id: null, invoiced: { $sum: '$amount' } } },
      ]);
      invoicedTotal = invUserAgg[0]?.invoiced || 0;
    } else {
      const invAgg = await Invoice.aggregate([
        { $match: invMatchPeriod },
        { $group: { _id: null, invoiced: { $sum: { $ifNull: ['$total', 0] } } } },
      ]);
      invoicedTotal = invAgg[0]?.invoiced || 0;
    }

    // ---------- REVENUE (payments in period, scoped) ----------
    // For user scope, attribute by invoice items -> timeentry.userId
    const payMatch = {
      status: 'cleared',
      receivedDate: { $gte: start, $lt: end },
    };
    let revenue = 0;

    if (scope === 'firm' || !scopeId) {
      const payAgg = await Payment.aggregate([
        { $match: payMatch },
        { $group: { _id: null, revenue: { $sum: '$amount' } } },
      ]);
      revenue = payAgg[0]?.revenue || 0;
    } else if (scope === 'client' || scope === 'case') {
      const matchInvoice = {};
      if (scope === 'client') matchInvoice.clientId = new mongoose.Types.ObjectId(scopeId);
      if (scope === 'case') matchInvoice.caseId = new mongoose.Types.ObjectId(scopeId);

      const payAgg = await Payment.aggregate([
        { $match: payMatch },
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
        { $group: { _id: null, revenue: { $sum: '$amount' } } },
      ]);
      revenue = payAgg[0]?.revenue || 0;
    } else if (scope === 'user') {
      const userId = new mongoose.Types.ObjectId(scopeId);
      // Attribute payments proportionally to the sum of item amounts per user per invoice
      const payAgg = await Payment.aggregate([
        { $match: payMatch },
        {
          $lookup: { from: 'invoices', localField: 'invoiceId', foreignField: '_id', as: 'inv' },
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
            byUser: {
              $push: { userId: '$_id.userId', itemAmt: '$itemAmt' },
            },
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
        { $group: { _id: null, revenue: { $sum: '$allocations.share' } } },
      ]);
      revenue = payAgg[0]?.revenue || 0;
    }

    // ---------- AR (as of end of period) ----------
    // AR = invoices issued <= end (not void) minus payments received <= end
    const invMatchToEnd = { issueDate: { $lt: end }, status: { $ne: 'void' } };
    if (scope === 'client' && scopeId) invMatchToEnd.clientId = new mongoose.Types.ObjectId(scopeId);
    if (scope === 'case' && scopeId) invMatchToEnd.caseId = new mongoose.Types.ObjectId(scopeId);

    let arInvoicesSum = 0;
    if (scope === 'user' && scopeId) {
      const arInvUser = await Invoice.aggregate([
        { $match: invMatchToEnd },
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
        { $group: { _id: '$_id', amount: { $sum: { $ifNull: ['$items.amount', 0] } } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      arInvoicesSum = arInvUser[0]?.total || 0;
    } else {
      const arInv = await Invoice.aggregate([
        { $match: invMatchToEnd },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$total', 0] } } } },
      ]);
      arInvoicesSum = arInv[0]?.total || 0;
    }

    let arPaymentsSum = 0;
    if (scope === 'firm' || !scopeId) {
      const arPay = await Payment.aggregate([
        { $match: { status: 'cleared', receivedDate: { $lt: end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      arPaymentsSum = arPay[0]?.total || 0;
    } else if (scope === 'client' || scope === 'case') {
      const matchInvoice = {};
      if (scope === 'client') matchInvoice.clientId = new mongoose.Types.ObjectId(scopeId);
      if (scope === 'case') matchInvoice.caseId = new mongoose.Types.ObjectId(scopeId);
      const arPay = await Payment.aggregate([
        { $match: { status: 'cleared', receivedDate: { $lt: end } } },
        { $lookup: { from: 'invoices', localField: 'invoiceId', foreignField: '_id', as: 'inv' } },
        { $unwind: '$inv' },
        { $match: matchInvoice },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      arPaymentsSum = arPay[0]?.total || 0;
    } else if (scope === 'user') {
      const userId = new mongoose.Types.ObjectId(scopeId);
      const arPay = await Payment.aggregate([
        { $match: { status: 'cleared', receivedDate: { $lt: end } } },
        { $lookup: { from: 'invoices', localField: 'invoiceId', foreignField: '_id', as: 'inv' } },
        { $unwind: '$inv' },
        { $unwind: '$inv.items' },
        { $lookup: { from: 'timeentries', localField: 'inv.items.billableId', foreignField: '_id', as: 'te' } },
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
      arPaymentsSum = arPay[0]?.total || 0;
    }

    const AR = Math.max(0, Number((arInvoicesSum - arPaymentsSum).toFixed(2)));

    // ---------- REALIZATION ----------
    const realization = invoicedTotal > 0 ? revenue / invoicedTotal : 0;

    res.json({
      scope,
      scopeId,
      period: { start, end },
      revenue: Number(revenue.toFixed(2)),
      WIP: Number(WIP.toFixed(2)),
      AR: Number(AR.toFixed(2)),
      utilization,
      realization,
      invoiced: Number(invoicedTotal.toFixed(2)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute KPI summary' });
  }
};

/**
 * Return a simple month-over-month trend for a metric.
 * Query: metric=revenue|WIP|AR|utilization|realization, months=6, scope, scopeId
 */
export const getKpiTrend = async (req, res) => {
  const months = Math.max(1, Math.min(Number(req.query.months || 6), 36));
  const metric = (req.query.metric || 'revenue').toLowerCase();
  const now = new Date();

  const out = [];
  // compute month strings YYYY-MM descending
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    out.push({ month: `${yyyy}-${mm}` });
  }

  // call summary per month (sequential to keep it simple)
  const scope = req.query.scope;
  const scopeId = req.query.scopeId;

  const results = [];
  for (const row of out) {
    req.query.month = row.month; // reuse handler logic
    try {
      const { start, end } = toDateRange({ month: row.month });
      // mimic partial summary for the metric (avoid recomputing all joins repeatedly?)
      // Simplicity: reuse getKpiSummary via function would require refactor; recompute minimal bits per metric.

      // Build minimal responses by metric:
      let value = 0;
      if (metric === 'revenue') {
        // Switch to payments-only calculation with scope same as above
        // Quick reuse: call getKpiSummary-like path by fabricating req.query and calling Payment aggregates
        const fakeReq = { query: { scope, scopeId, from: start.toISOString(), to: end.toISOString() } };
        const fakeRes = { json: (x) => x };
        // Not calling handler recursively; just re-run the revenue block inline for performance/clarity.
        const payMatch = { status: 'cleared', receivedDate: { $gte: start, $lt: end } };
        if (!scope || scope === 'firm' || !scopeId) {
          const agg = await Payment.aggregate([{ $match: payMatch }, { $group: { _id: null, revenue: { $sum: '$amount' } } }]);
          value = agg[0]?.revenue || 0;
        } else if (scope === 'client' || scope === 'case') {
          const matchInvoice = {};
          if (scope === 'client') matchInvoice.clientId = new mongoose.Types.ObjectId(scopeId);
          if (scope === 'case') matchInvoice.caseId = new mongoose.Types.ObjectId(scopeId);
          const agg = await Payment.aggregate([
            { $match: payMatch },
            { $lookup: { from: 'invoices', localField: 'invoiceId', foreignField: '_id', as: 'inv' } },
            { $unwind: '$inv' },
            { $match: matchInvoice },
            { $group: { _id: null, revenue: { $sum: '$amount' } } },
          ]);
          value = agg[0]?.revenue || 0;
        } else if (scope === 'user') {
          const userId = new mongoose.Types.ObjectId(scopeId);
          const agg = await Payment.aggregate([
            { $match: payMatch },
            { $lookup: { from: 'invoices', localField: 'invoiceId', foreignField: '_id', as: 'inv' } },
            { $unwind: '$inv' },
            { $unwind: '$inv.items' },
            { $lookup: { from: 'timeentries', localField: 'inv.items.billableId', foreignField: '_id', as: 'te' } },
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
            { $group: { _id: null, revenue: { $sum: '$allocations.share' } } },
          ]);
          value = agg[0]?.revenue || 0;
        }
      } else if (metric === 'WIP' || metric === 'wip') {
        const wipAgg = await TimeEntry.aggregate([
          {
            $match: {
              ...scopeFilters(scope, scopeId),
              status: { $in: ['submitted', 'approved'] },
              date: { $lt: end },
            },
          },
          { $group: { _id: null, WIP: { $sum: { $ifNull: ['$amount', 0] } } } },
        ]);
        value = wipAgg[0]?.WIP || 0;
      } else if (metric === 'AR' || metric === 'ar') {
        // AR as of end of month
        req.query.from = undefined; req.query.to = undefined;
        const { start: s, end: e } = { start, end };
        // reuse logic from summary (trimmed)
        const invMatchToEnd = { issueDate: { $lt: e }, status: { $ne: 'void' } };
        if (scope === 'client' && scopeId) invMatchToEnd.clientId = new mongoose.Types.ObjectId(scopeId);
        if (scope === 'case' && scopeId) invMatchToEnd.caseId = new mongoose.Types.ObjectId(scopeId);
        let invSum = 0;
        if (scope === 'user' && scopeId) {
          const a = await Invoice.aggregate([
            { $match: invMatchToEnd },
            { $unwind: '$items' },
            { $lookup: { from: 'timeentries', localField: 'items.billableId', foreignField: '_id', as: 'te' } },
            { $unwind: '$te' },
            { $match: { 'te.userId': new mongoose.Types.ObjectId(scopeId) } },
            { $group: { _id: '$_id', amount: { $sum: { $ifNull: ['$items.amount', 0] } } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]);
          invSum = a[0]?.total || 0;
        } else {
          const a = await Invoice.aggregate([{ $match: invMatchToEnd }, { $group: { _id: null, total: { $sum: { $ifNull: ['$total', 0] } } } }]);
          invSum = a[0]?.total || 0;
        }
        let paySum = 0;
        if (!scope || scope === 'firm' || !scopeId) {
          const p = await Payment.aggregate([{ $match: { status: 'cleared', receivedDate: { $lt: e } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
          paySum = p[0]?.total || 0;
        } else if (scope === 'client' || scope === 'case') {
          const m = {};
          if (scope === 'client') m.clientId = new mongoose.Types.ObjectId(scopeId);
          if (scope === 'case') m.caseId = new mongoose.Types.ObjectId(scopeId);
          const p = await Payment.aggregate([
            { $match: { status: 'cleared', receivedDate: { $lt: e } } },
            { $lookup: { from: 'invoices', localField: 'invoiceId', foreignField: '_id', as: 'inv' } },
            { $unwind: '$inv' },
            { $match: m },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]);
          paySum = p[0]?.total || 0;
        } else if (scope === 'user') {
          const userId = new mongoose.Types.ObjectId(scopeId);
          const p = await Payment.aggregate([
            { $match: { status: 'cleared', receivedDate: { $lt: e } } },
            { $lookup: { from: 'invoices', localField: 'invoiceId', foreignField: '_id', as: 'inv' } },
            { $unwind: '$inv' },
            { $unwind: '$inv.items' },
            { $lookup: { from: 'timeentries', localField: 'inv.items.billableId', foreignField: '_id', as: 'te' } },
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
        value = Math.max(0, Number((invSum - paySum).toFixed(2)));
      } else if (metric === 'utilization') {
        const a = await TimeEntry.aggregate([
          { $match: { ...scopeFilters(scope, scopeId), date: { $gte: start, $lt: end } } },
          { $group: { _id: null, b: { $sum: { $ifNull: ['$billableMinutes', 0] } }, n: { $sum: { $ifNull: ['$nonbillableMinutes', 0] } } } },
          { $project: { _id: 0, u: { $cond: [{ $gt: [{ $add: ['$b', '$n'] }, 0] }, { $divide: ['$b', { $add: ['$b', '$n'] }] }, 0] } } },
        ]);
        value = a[0]?.u || 0;
      } else if (metric === 'realization') {
        // realization = revenue / invoiced (both period)
        const { start: s, end: e } = { start, end };
        req.query.scope = scope; req.query.scopeId = scopeId;
        // quick reuse: compute rev and inv as above
        // revenue:
        let rev = 0, inv = 0;
        // ...revenue same as in summary (client/case/user/firm paths)...
        // (Use the simplest: call getKpiSummary-like logic partially)
        // For brevity here: reuse revenue block from 'revenue' branch above
        // (copy-paste omitted in this comment)
        // Implement minimal duplicates:
        const payMatch = { status: 'cleared', receivedDate: { $gte: s, $lt: e } };
        if (!scope || scope === 'firm' || !scopeId) {
          const agg = await Payment.aggregate([{ $match: payMatch }, { $group: { _id: null, revenue: { $sum: '$amount' } } }]);
          rev = agg[0]?.revenue || 0;
          const a = await Invoice.aggregate([{ $match: { issueDate: { $gte: s, $lt: e }, status: { $ne: 'void' } } }, { $group: { _id: null, inv: { $sum: '$total' } } }]);
          inv = a[0]?.inv || 0;
        } else if (scope === 'client' || scope === 'case') {
          const m = {};
          if (scope === 'client') m.clientId = new mongoose.Types.ObjectId(scopeId);
          if (scope === 'case') m.caseId = new mongoose.Types.ObjectId(scopeId);
          const agg = await Payment.aggregate([
            { $match: payMatch },
            { $lookup: { from: 'invoices', localField: 'invoiceId', foreignField: '_id', as: 'inv' } },
            { $unwind: '$inv' },
            { $match: m },
            { $group: { _id: null, revenue: { $sum: '$amount' } } },
          ]);
          rev = agg[0]?.revenue || 0;
          const a = await Invoice.aggregate([{ $match: { ...m, issueDate: { $gte: s, $lt: e }, status: { $ne: 'void' } } }, { $group: { _id: null, inv: { $sum: '$total' } } }]);
          inv = a[0]?.inv || 0;
        } else if (scope === 'user') {
          const userId = new mongoose.Types.ObjectId(scopeId);
          const agg = await Payment.aggregate([
            { $match: payMatch },
            { $lookup: { from: 'invoices', localField: 'invoiceId', foreignField: '_id', as: 'inv' } },
            { $unwind: '$inv' },
            { $unwind: '$inv.items' },
            { $lookup: { from: 'timeentries', localField: 'inv.items.billableId', foreignField: '_id', as: 'te' } },
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
            { $group: { _id: null, revenue: { $sum: '$allocations.share' } } },
          ]);
          rev = agg[0]?.revenue || 0;
          const a = await Invoice.aggregate([
            { $match: { issueDate: { $gte: s, $lt: e }, status: { $ne: 'void' } } },
            { $unwind: '$items' },
            { $lookup: { from: 'timeentries', localField: 'items.billableId', foreignField: '_id', as: 'te' } },
            { $unwind: '$te' },
            { $match: { 'te.userId': userId } },
            { $group: { _id: '$_id', amt: { $sum: { $ifNull: ['$items.amount', 0] } } } },
            { $group: { _id: null, inv: { $sum: '$amt' } } },
          ]);
          inv = a[0]?.inv || 0;
        }
        value = inv > 0 ? rev / inv : 0;
      } else {
        value = 0;
      }

      results.push({ month: row.month, value: Number((typeof value === 'number' ? value : 0).toFixed(4)) });
    } catch (e) {
      results.push({ month: row.month, value: 0 });
    }
  }

  res.json({ metric, scope: normalizeScope(scope || 'firm'), scopeId: scopeId || null, results });
};
