// src/controllers/reportsController.js
import { Parser as Json2csv } from 'json2csv';
import mongoose from 'mongoose';
import { TimeEntry } from '../models/TimeEntry.js';
import { Invoice } from '../models/Invoice.js';

/**
 * Utilities
 */
function asDate(s, fallback = null) {
  if (!s) return fallback;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? fallback : d;
}
function sendCsv(res, rows, filename) {
  const parser = new Json2csv();
  const csv = parser.parse(rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
}

/**
 * GET /api/reports/time-entries.csv
 * Query: from?, to?, clientId?, caseId?, userId?, status?
 */
export const exportTimeEntriesCsv = async (req, res) => {
  try {
    const { clientId, caseId, userId, status } = req.query;
    const from = asDate(req.query.from);
    const to = asDate(req.query.to);

    const q = {};
    if (clientId) q.clientId = new mongoose.Types.ObjectId(clientId);
    if (caseId) q.caseId = new mongoose.Types.ObjectId(caseId);
    if (userId) q.userId = new mongoose.Types.ObjectId(userId);
    if (status) q.status = status;
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = from;
      if (to) q.date.$lte = to;
    }

    const rows = await TimeEntry.find(q)
      .select('date clientId caseId userId narrative billableMinutes nonbillableMinutes rateApplied amount status createdAt updatedAt')
      .sort({ date: 1 })
      .lean();

    const shaped = rows.map(r => ({
      date: r.date?.toISOString()?.slice(0, 10),
      clientId: r.clientId,
      caseId: r.caseId,
      userId: r.userId,
      narrative: r.narrative,
      billableMinutes: r.billableMinutes || 0,
      nonbillableMinutes: r.nonbillableMinutes || 0,
      rateApplied: r.rateApplied ?? '',
      amount: r.amount ?? '',
      status: r.status,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    }));

    return sendCsv(res, shaped, 'time-entries.csv');
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to export time entries CSV' });
  }
};

/**
 * GET /api/reports/invoices.csv
 * Query: from?, to?, clientId?, caseId?, status?
 */
export const exportInvoicesCsv = async (req, res) => {
  try {
    const { clientId, caseId, status } = req.query;
    const from = asDate(req.query.from);
    const to = asDate(req.query.to);

    const q = {};
    if (clientId) q.clientId = new mongoose.Types.ObjectId(clientId);
    if (caseId) q.caseId = new mongoose.Types.ObjectId(caseId);
    if (status) q.status = status;
    if (from || to) {
      q.issueDate = {};
      if (from) q.issueDate.$gte = from;
      if (to) q.issueDate.$lte = to;
    }

    const rows = await Invoice.find(q)
      .select('issueDate dueDate clientId caseId subtotal tax total status createdAt updatedAt')
      .sort({ issueDate: 1 })
      .lean();

    const shaped = rows.map(r => ({
      issueDate: r.issueDate?.toISOString()?.slice(0, 10),
      dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : '',
      clientId: r.clientId,
      caseId: r.caseId ?? '',
      subtotal: r.subtotal ?? 0,
      tax: r.tax ?? 0,
      total: r.total ?? 0,
      status: r.status,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    }));

    return sendCsv(res, shaped, 'invoices.csv');
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to export invoices CSV' });
  }
};

/**
 * GET /api/reports/utilization.csv
 * Query: from(required), to(required), groupBy=user|case|client
 * Output: percentage utilization per group (billable / (billable+nonbillable))
 */
export const exportUtilizationCsv = async (req, res) => {
  try {
    const from = asDate(req.query.from);
    const to = asDate(req.query.to);
    const groupBy = (req.query.groupBy || 'user').toLowerCase();
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
    if (!['user', 'case', 'client'].includes(groupBy)) return res.status(400).json({ error: 'groupBy must be user|case|client' });

    const groupField = groupBy === 'user' ? '$userId' : groupBy === 'case' ? '$caseId' : '$clientId';

    const rows = await TimeEntry.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: groupField,
          billable: { $sum: { $ifNull: ['$billableMinutes', 0] } },
          nonbillable: { $sum: { $ifNull: ['$nonbillableMinutes', 0] } },
        },
      },
      {
        $project: {
          groupId: '$_id',
          billable: 1,
          nonbillable: 1,
          utilization: {
            $cond: [
              { $gt: [{ $add: ['$billable', '$nonbillable'] }, 0] },
              { $divide: ['$billable', { $add: ['$billable', '$nonbillable'] }] },
              0,
            ],
          },
          _id: 0,
        },
      },
      { $sort: { groupId: 1 } },
    ]);

    const shaped = rows.map(r => ({
      groupBy,
      groupId: r.groupId,
      billableMinutes: r.billable,
      nonbillableMinutes: r.nonbillable,
      utilization: Number((r.utilization * 100).toFixed(2)), // %
    }));

    return sendCsv(res, shaped, `utilization_${groupBy}.csv`);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to export utilization CSV' });
  }
};

/**
 * GET /api/reports/pdf
 * Placeholder for PDF export (wire your PDF generation library here)
 */
export const exportPdf = async (_req, res) => {
  res.status(501).json({ error: 'PDF export not implemented in MVP. Plug your PDF generator here.' });
};
