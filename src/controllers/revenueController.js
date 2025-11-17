// src/controllers/revenueController.js
import mongoose from 'mongoose';
import { TimeEntry } from '../models/TimeEntry.js';

/**
 * Compute a reliable monetary value for a time entry:
 * prefer stored `amount`; otherwise rateApplied * (billableMinutes/60)
 */
function moneyExpr() {
  return {
    $cond: [
      { $gt: [{ $ifNull: ['$amount', 0] }, 0] },
      { $ifNull: ['$amount', 0] },
      {
        $multiply: [
          { $ifNull: ['$rateApplied', 0] },
          { $divide: [{ $ifNull: ['$billableMinutes', 0] }, 60] }
        ]
      }
    ]
  };
}

/**
 * GET /api/revenue/breakdown
 * Query:
 *  - groupBy = month|client|case|user|role
 *  - from?, to?
 *  - status? (default: approved|billed|paid)
 *
 * NOTE: groupBy=role requires the User model to join roles, which this controller
 * intentionally does not use (per spec). We return 400 for that case.
 */
export const getRevenueBreakdown = async (req, res) => {
  try {
    const groupBy = (req.query.groupBy || 'month').toLowerCase();
    if (groupBy === 'role') {
      return res.status(400).json({ error: 'groupBy=role is not available in RevenueController (TimeEntry-only).' });
    }

    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    const status = req.query.status
      ? req.query.status.split(',').map(s => s.trim())
      : ['approved', 'billed', 'paid'];

    const match = { status: { $in: status } };
    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = from;
      if (to) match.date.$lte = to;
    }

    // Group key
    let groupId;
    if (groupBy === 'month') {
      groupId = { $dateToString: { format: '%Y-%m', date: '$date' } };
    } else if (groupBy === 'client') {
      groupId = '$clientId';
    } else if (groupBy === 'case') {
      groupId = '$caseId';
    } else if (groupBy === 'user') {
      groupId = '$userId';
    } else {
      return res.status(400).json({ error: 'groupBy must be one of month|client|case|user|role' });
    }

    const rows = await TimeEntry.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupId,
          value: { $sum: moneyExpr() },
          entries: { $sum: 1 },
          minutes: { $sum: { $ifNull: ['$billableMinutes', 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const shaped = rows.map(r => ({
      group: r._id,
      amount: Number((r.value || 0).toFixed(2)),
      entries: r.entries,
      billableMinutes: r.minutes
    }));

    res.json({ groupBy, from, to, status, results: shaped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute revenue breakdown' });
  }
};

/**
 * GET /api/revenue/monthly
 * Query: months=6 (default), status?
 */
export const getMonthlyRevenue = async (req, res) => {
  try {
    const months = Math.max(1, Math.min(Number(req.query.months || 6), 48));
    const status = req.query.status
      ? req.query.status.split(',').map(s => s.trim())
      : ['approved', 'billed', 'paid'];

    const now = new Date();
    const startAnchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

    const rows = await TimeEntry.aggregate([
      {
        $match: {
          status: { $in: status },
          date: { $gte: startAnchor }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          value: { $sum: moneyExpr() }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const results = rows.map(r => ({ month: r._id, amount: Number((r.value || 0).toFixed(2)) }));
    res.json({ months, status, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute monthly revenue' });
  }
};
