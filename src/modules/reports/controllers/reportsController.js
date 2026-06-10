// src/controllers/reportsController.js
import { Parser as Json2csv } from 'json2csv';
import mongoose from 'mongoose';
import { TimeEntry } from '../../timeEntries/models/TimeEntry.js';
import { Invoice } from '../../invoices/models/Invoice.js';

function asDate(s, fallback = null) {
  if (!s) return fallback;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function asObjectId(value) {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(String(value)) ? new mongoose.Types.ObjectId(value) : false;
}

function idString(value) {
  return value?._id ? String(value._id) : value ? String(value) : '';
}

function displayClient(client) {
  return client?.displayName || client?.name || '';
}

function displayCase(matter) {
  return matter?.title || matter?.name || '';
}

function displayUser(user) {
  return user?.name || user?.email || '';
}

function sendCsv(res, rows, filename, fields) {
  const parser = new Json2csv({ fields });
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
    const clientObjectId = asObjectId(clientId);
    const caseObjectId = asObjectId(caseId);
    const userObjectId = asObjectId(userId);
    if ((clientId && !clientObjectId) || (caseId && !caseObjectId) || (userId && !userObjectId)) {
      return res.status(400).json({ error: 'Invalid clientId, caseId, or userId' });
    }

    const q = {};
    if (clientObjectId) q.clientId = clientObjectId;
    if (caseObjectId) q.caseId = caseObjectId;
    if (userObjectId) q.userId = userObjectId;
    if (status) q.status = status;
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = from;
      if (to) q.date.$lte = to;
    }

    const rows = await TimeEntry.find(q)
      .select('date clientId caseId userId narrative billableMinutes nonbillableMinutes rateApplied amount status createdAt updatedAt')
      .populate('clientId', 'displayName name')
      .populate('caseId', 'title name')
      .populate('userId', 'name email role')
      .sort({ date: 1 })
      .lean();

    const shaped = rows.map(r => ({
      date: r.date?.toISOString()?.slice(0, 10),
      clientId: idString(r.clientId),
      clientName: displayClient(r.clientId),
      caseId: idString(r.caseId),
      caseTitle: displayCase(r.caseId),
      userId: idString(r.userId),
      userName: displayUser(r.userId),
      userRole: r.userId?.role || '',
      narrative: r.narrative,
      billableMinutes: r.billableMinutes || 0,
      nonbillableMinutes: r.nonbillableMinutes || 0,
      rateApplied: r.rateApplied ?? '',
      amount: r.amount ?? '',
      status: r.status,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    }));

    return sendCsv(res, shaped, 'time-entries.csv', [
      'date',
      'clientId',
      'clientName',
      'caseId',
      'caseTitle',
      'userId',
      'userName',
      'userRole',
      'narrative',
      'billableMinutes',
      'nonbillableMinutes',
      'rateApplied',
      'amount',
      'status',
      'createdAt',
      'updatedAt',
    ]);
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
    const clientObjectId = asObjectId(clientId);
    const caseObjectId = asObjectId(caseId);
    if ((clientId && !clientObjectId) || (caseId && !caseObjectId)) {
      return res.status(400).json({ error: 'Invalid clientId or caseId' });
    }

    const q = {};
    if (clientObjectId) q.clientId = clientObjectId;
    if (caseObjectId) q.caseId = caseObjectId;
    if (status) q.status = status;
    if (from || to) {
      q.issueDate = {};
      if (from) q.issueDate.$gte = from;
      if (to) q.issueDate.$lte = to;
    }

    const rows = await Invoice.find(q)
      .select('issueDate dueDate clientId caseId currency subtotal tax taxName taxRatePct taxInclusive total status sentAt deliveryStatus createdAt updatedAt')
      .populate('clientId', 'displayName name')
      .populate('caseId', 'title name')
      .sort({ issueDate: 1 })
      .lean();

    const shaped = rows.map(r => ({
      invoiceId: idString(r._id),
      issueDate: r.issueDate?.toISOString()?.slice(0, 10),
      dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : '',
      clientId: idString(r.clientId),
      clientName: displayClient(r.clientId),
      caseId: idString(r.caseId),
      caseTitle: displayCase(r.caseId),
      currency: r.currency || 'INR',
      subtotal: r.subtotal ?? 0,
      taxName: r.taxName || 'GST',
      taxRatePct: r.taxRatePct ?? 0,
      taxInclusive: Boolean(r.taxInclusive),
      tax: r.tax ?? 0,
      total: r.total ?? 0,
      status: r.status,
      sentAt: r.sentAt?.toISOString() || '',
      deliveryStatus: r.deliveryStatus || '',
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    }));

    return sendCsv(res, shaped, 'invoices.csv', [
      'invoiceId',
      'issueDate',
      'dueDate',
      'clientId',
      'clientName',
      'caseId',
      'caseTitle',
      'currency',
      'subtotal',
      'taxName',
      'taxRatePct',
      'taxInclusive',
      'tax',
      'total',
      'status',
      'sentAt',
      'deliveryStatus',
      'createdAt',
      'updatedAt',
    ]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to export invoices CSV' });
  }
};

/**
 * GET /api/reports/gst-summary
 * Query: from?, to?, clientId?, caseId?, status?
 */
export const getGstSummary = async (req, res) => {
  try {
    const { clientId, caseId, status } = req.query;
    const from = asDate(req.query.from);
    const to = asDate(req.query.to);
    const clientObjectId = asObjectId(clientId);
    const caseObjectId = asObjectId(caseId);
    if ((clientId && !clientObjectId) || (caseId && !caseObjectId)) {
      return res.status(400).json({ error: 'Invalid clientId or caseId' });
    }

    const match = { status: { $ne: 'void' } };
    if (clientObjectId) match.clientId = clientObjectId;
    if (caseObjectId) match.caseId = caseObjectId;
    if (status) match.status = status;
    if (from || to) {
      match.issueDate = {};
      if (from) match.issueDate.$gte = from;
      if (to) match.issueDate.$lte = to;
    }

    const [summary] = await Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          invoiceCount: { $sum: 1 },
          taxableAmount: { $sum: { $ifNull: ['$subtotal', 0] } },
          gstAmount: { $sum: { $ifNull: ['$tax', 0] } },
          grossAmount: { $sum: { $ifNull: ['$total', 0] } },
        },
      },
      { $project: { _id: 0, invoiceCount: 1, taxableAmount: 1, gstAmount: 1, grossAmount: 1 } },
    ]);

    res.json(summary || { invoiceCount: 0, taxableAmount: 0, gstAmount: 0, grossAmount: 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to build GST summary' });
  }
};

/**
 * GET /api/reports/gst.csv
 * Query: from?, to?, clientId?, caseId?, status?
 */
export const exportGstCsv = async (req, res) => {
  try {
    const { clientId, caseId, status } = req.query;
    const from = asDate(req.query.from);
    const to = asDate(req.query.to);
    const clientObjectId = asObjectId(clientId);
    const caseObjectId = asObjectId(caseId);
    if ((clientId && !clientObjectId) || (caseId && !caseObjectId)) {
      return res.status(400).json({ error: 'Invalid clientId or caseId' });
    }

    const q = { status: { $ne: 'void' } };
    if (clientObjectId) q.clientId = clientObjectId;
    if (caseObjectId) q.caseId = caseObjectId;
    if (status) q.status = status;
    if (from || to) {
      q.issueDate = {};
      if (from) q.issueDate.$gte = from;
      if (to) q.issueDate.$lte = to;
    }

    const rows = await Invoice.find(q)
      .select('issueDate dueDate clientId caseId currency subtotal tax taxName taxRatePct taxInclusive total status sentAt deliveryStatus createdAt')
      .populate('clientId', 'displayName name')
      .populate('caseId', 'title name')
      .sort({ issueDate: 1 })
      .lean();

    const shaped = rows.map(r => ({
      invoiceId: idString(r._id),
      issueDate: r.issueDate?.toISOString()?.slice(0, 10),
      clientName: displayClient(r.clientId),
      caseTitle: displayCase(r.caseId),
      currency: r.currency || 'INR',
      taxableAmount: r.subtotal ?? 0,
      gstName: r.taxName || 'GST',
      gstRatePct: r.taxRatePct ?? 0,
      gstInclusive: Boolean(r.taxInclusive),
      gstAmount: r.tax ?? 0,
      grossAmount: r.total ?? 0,
      status: r.status,
      deliveryStatus: r.deliveryStatus || '',
      sentAt: r.sentAt?.toISOString() || '',
      createdAt: r.createdAt?.toISOString() || '',
    }));

    return sendCsv(res, shaped, 'gst-report.csv', [
      'invoiceId',
      'issueDate',
      'clientName',
      'caseTitle',
      'currency',
      'taxableAmount',
      'gstName',
      'gstRatePct',
      'gstInclusive',
      'gstAmount',
      'grossAmount',
      'status',
      'deliveryStatus',
      'sentAt',
      'createdAt',
    ]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to export GST CSV' });
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

    return sendCsv(res, shaped, `utilization_${groupBy}.csv`, [
      'groupBy',
      'groupId',
      'billableMinutes',
      'nonbillableMinutes',
      'utilization',
    ]);
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
