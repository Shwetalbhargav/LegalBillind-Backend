//src/controllers/analyticsController.js
import mongoose from 'mongoose';

import Billable from '../../billables/models/Billable.js';
import {Invoice} from '../../invoices/models/Invoice.js';

const objectId = (value) => (
  mongoose.Types.ObjectId.isValid(String(value)) ? new mongoose.Types.ObjectId(value) : null
);

const dateMatch = (field, query) => {
  const range = {};
  if (query.from) range.$gte = new Date(query.from);
  if (query.to) range.$lte = new Date(query.to);
  return Object.keys(range).length ? { [field]: range } : {};
};

const billedStatuses = ['billed', 'Logged'];
const billedMatch = { $or: [{ status: { $in: billedStatuses } }, { pushedAt: { $ne: null } }, { externalEntryId: { $nin: [null, ''] } }] };
const unbilledMatch = { $and: [{ status: { $nin: billedStatuses } }, { pushedAt: null }, { externalEntryId: { $in: [null, ''] } }] };
const loggedExpression = {
  $or: [
    { $in: ['$status', billedStatuses] },
    { $ne: ['$pushedAt', null] },
    { $and: [{ $ne: ['$externalEntryId', null] }, { $ne: ['$externalEntryId', ''] }] },
  ],
};

function applyEntityFilters(match, query) {
  const clientId = query.clientId ? objectId(query.clientId) : null;
  const caseId = query.caseId ? objectId(query.caseId) : null;
  const userId = query.userId ? objectId(query.userId) : null;
  if (query.clientId && !clientId) return false;
  if (query.caseId && !caseId) return false;
  if (query.userId && !userId) return false;
  if (clientId) match.clientId = clientId;
  if (caseId) match.caseId = caseId;
  if (userId) match.userId = userId;
  return true;
}

export const getBillableStats = async (req, res) => {
  try {
    const match = { ...dateMatch('date', req.query) };
    if (!applyEntityFilters(match, req.query)) return res.status(400).json({ error: 'Invalid id filter' });

    const data = await Billable.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$category', 'Uncategorized'] },
          totalMinutes: { $sum: { $ifNull: ['$durationMinutes', 0] } },
          totalHours: { $sum: { $divide: [{ $ifNull: ['$durationMinutes', 0] }, 60] } },
          totalValue: { $sum: { $ifNull: ['$amount', 0] } },
          entries: { $sum: 1 },
          loggedEntries: {
            $sum: {
              $cond: [
                loggedExpression,
                1,
                0,
              ],
            },
          },
        }
      },
      {
        $project: {
          category: '$_id',
          totalMinutes: 1,
          totalHours: 1,
          totalValue: 1,
          entries: 1,
          loggedPct: {
            $cond: [{ $gt: ['$entries', 0] }, { $multiply: [{ $divide: ['$loggedEntries', '$entries'] }, 100] }, 0],
          },
        }
      },
      { $sort: { totalValue: -1 } }
    ]);
    const totals = data.reduce((acc, row) => ({
      entries: acc.entries + row.entries,
      totalMinutes: acc.totalMinutes + row.totalMinutes,
      totalHours: acc.totalHours + row.totalHours,
      totalValue: acc.totalValue + row.totalValue,
    }), { entries: 0, totalMinutes: 0, totalHours: 0, totalValue: 0 });
    res.json({ summaryByCategory: data, totals });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute billable stats' });
  }
};

export const getInvoiceStats = async (req, res) => {
  try {
    const match = { ...dateMatch('issueDate', req.query) };
    const clientId = req.query.clientId ? objectId(req.query.clientId) : null;
    const caseId = req.query.caseId ? objectId(req.query.caseId) : null;
    if ((req.query.clientId && !clientId) || (req.query.caseId && !caseId)) {
      return res.status(400).json({ error: 'Invalid id filter' });
    }
    if (clientId) match.clientId = clientId;
    if (caseId) match.caseId = caseId;

    const data = await Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          totalRevenue: { $sum: { $ifNull: ['$total', 0] } },
          subtotal: { $sum: { $ifNull: ['$subtotal', 0] } },
          tax: { $sum: { $ifNull: ['$tax', 0] } },
          count: { $sum: 1 }
        }
      }
    ]);
    const totals = data.reduce((acc, row) => ({
      count: acc.count + row.count,
      subtotal: acc.subtotal + row.subtotal,
      tax: acc.tax + row.tax,
      totalRevenue: acc.totalRevenue + row.totalRevenue,
    }), { count: 0, subtotal: 0, tax: 0, totalRevenue: 0 });
    res.json({ invoices: data, totals });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute invoice stats' });
  }
};

export const getUnbilledBillables = async (req, res) => {
  try {
    const match = { ...unbilledMatch, ...dateMatch('date', req.query) };
    if (!applyEntityFilters(match, req.query)) return res.status(400).json({ error: 'Invalid id filter' });
    const unbilled = await Billable.find(match)
      .populate('clientId', 'displayName name')
      .populate('caseId', 'title name case_type')
      .populate('userId', 'name email role')
      .sort({ date: -1 });
    const totals = unbilled.reduce((acc, entry) => ({
      count: acc.count + 1,
      totalMinutes: acc.totalMinutes + (entry.durationMinutes || 0),
      totalHours: acc.totalHours + ((entry.durationMinutes || 0) / 60),
      totalValue: acc.totalValue + (entry.amount || 0),
    }), { count: 0, totalMinutes: 0, totalHours: 0, totalValue: 0 });
    res.json({ count: unbilled.length, totals, entries: unbilled });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get unbilled entries' });
  }
};

export const getBillableStatsByCaseType = async (req, res) => {
  try {
    const match = { ...dateMatch('date', req.query) };
    if (!applyEntityFilters(match, req.query)) return res.status(400).json({ error: 'Invalid id filter' });
    const pipeline = [
      { $match: match },
      { $lookup: { from: 'cases', localField: 'caseId', foreignField: '_id', as: 'case' } },
      { $unwind: { path: '$case', preserveNullAndEmptyArrays: true } },
      ...(req.query.caseType ? [{ $match: { 'case.case_type': req.query.caseType } }] : []),
      ...(req.query.caseTypeId && objectId(req.query.caseTypeId) ? [{ $match: { 'case.case_type_id': objectId(req.query.caseTypeId) } }] : []),
      {
        $group: {
          _id: { $ifNull: ['$case.case_type', 'Unclassified'] },
          totalHours: { $sum: { $divide: [{ $ifNull: ['$durationMinutes', 0] }, 60] } },
          totalValue: { $sum: { $ifNull: ['$amount', 0] } },
          entries: { $sum: 1 },
          loggedEntries: {
            $sum: {
              $cond: [
                loggedExpression,
                1,
                0,
              ],
            },
          },
        }
      },
      {
        $project: {
          caseType: '$_id',
          totalHours: 1,
          totalValue: 1,
          entries: 1,
          avgRate: { $cond: [{ $gt: ['$totalHours', 0] }, { $divide: ['$totalValue', '$totalHours'] }, 0] },
          loggedPct: {
            $cond: [{ $gt: ['$entries', 0] }, { $multiply: [{ $divide: ['$loggedEntries', '$entries'] }, 100] }, 0],
          },
        }
      },
      { $sort: { totalValue: -1 } }
    ];
    const data = await Billable.aggregate(pipeline);
    res.json({ summaryByCaseType: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute billable stats by case type' });
  }
};

export const getUnbilledStatsByClient = async (req, res) => {
  try {
    const matchStage = { ...unbilledMatch, ...dateMatch('date', req.query) };
    if (!applyEntityFilters(matchStage, req.query)) return res.status(400).json({ error: 'Invalid id filter' });

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$clientId',
          totalUnbilledHours: { $sum: { $divide: [{ $ifNull: ['$durationMinutes', 0] }, 60] } },
          totalUnbilledValue: { $sum: { $ifNull: ['$amount', 0] } },
          entries: { $sum: 1 },
        },
      },
      // Join with clients collection to get names
      {
        $lookup: {
          from: 'clients',            // collection backing Client model
          localField: '_id',
          foreignField: '_id',
          as: 'client',
        },
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          clientId: '$_id',
          clientName: { $ifNull: ['$client.displayName', 'Unknown client'] },
          totalUnbilledHours: 1,
          totalUnbilledValue: 1,
          entries: 1,
        },
      },
      { $sort: { totalUnbilledValue: -1 } },
    ];

    const data = await Billable.aggregate(pipeline);
    res.json({ unbilledByClient: data });
  } catch (err) {
    console.error('getUnbilledStatsByClient error', err);
    res.status(500).json({ error: 'Failed to compute unbilled stats by client' });
  }
};
export const getUnbilledStatsByUser = async (req, res) => {
  try {
    const matchStage = { ...unbilledMatch, ...dateMatch('date', req.query) };
    if (!applyEntityFilters(matchStage, req.query)) return res.status(400).json({ error: 'Invalid id filter' });

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$userId',
          totalUnbilledHours: { $sum: { $divide: [{ $ifNull: ['$durationMinutes', 0] }, 60] } },
          totalUnbilledValue: { $sum: { $ifNull: ['$amount', 0] } },
          entries: { $sum: 1 },
        },
      },
      // Join with users to show lawyer name + role
      {
        $lookup: {
          from: 'users',           // collection backing User model
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: '$_id',
          userName: { $ifNull: ['$user.name', 'Unknown user'] },
          role: '$user.role',
          totalUnbilledHours: 1,
          totalUnbilledValue: 1,
          entries: 1,
        },
      },
      { $sort: { totalUnbilledValue: -1 } },
    ];

    const data = await Billable.aggregate(pipeline);
    res.json({ unbilledByUser: data });
  } catch (err) {
    console.error('getUnbilledStatsByUser error', err);
    res.status(500).json({ error: 'Failed to compute unbilled stats by user' });
  }
};
// Billed stats grouped by client (who has how much already billed)
export const getBilledStatsByClient = async (req, res) => {
  try {
    const matchStage = { ...billedMatch, ...dateMatch('date', req.query) };
    if (!applyEntityFilters(matchStage, req.query)) return res.status(400).json({ error: 'Invalid id filter' });

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$clientId',
          totalHours: { $sum: { $divide: [{ $ifNull: ['$durationMinutes', 0] }, 60] } },
          totalValue: { $sum: { $ifNull: ['$amount', 0] } },
          entries: { $sum: 1 },
        },
      },
      // Join to clients to get readable name
      {
        $lookup: {
          from: 'clients',              // backing collection for Client model
          localField: '_id',
          foreignField: '_id',
          as: 'client',
        },
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          clientId: '$_id',
          clientName: { $ifNull: ['$client.displayName', 'Unknown client'] },
          totalHours: 1,
          totalValue: 1,
          entries: 1,
        },
      },
      { $sort: { totalValue: -1 } },   // biggest billed clients first
    ];

    const data = await Billable.aggregate(pipeline);
    res.json({ billedByClient: data });
  } catch (err) {
    console.error('getBilledStatsByClient error', err);
    res.status(500).json({ error: 'Failed to compute billed stats by client' });
  }
};
// Billed stats grouped by user/lawyer (who has billed how much)
export const getBilledStatsByUser = async (req, res) => {
  try {
    const matchStage = { ...billedMatch, ...dateMatch('date', req.query) };
    if (!applyEntityFilters(matchStage, req.query)) return res.status(400).json({ error: 'Invalid id filter' });

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$userId',
          totalHours: { $sum: { $divide: [{ $ifNull: ['$durationMinutes', 0] }, 60] } },
          totalValue: { $sum: { $ifNull: ['$amount', 0] } },
          entries: { $sum: 1 },
        },
      },
      // Join to users to get lawyer name + role
      {
        $lookup: {
          from: 'users',          // backing collection for User model
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: '$_id',
          userName: { $ifNull: ['$user.name', 'Unknown user'] },
          role: '$user.role',
          totalHours: 1,
          totalValue: 1,
          entries: 1,
        },
      },
      { $sort: { totalValue: -1 } },  // which lawyer has billed the most
    ];

    const data = await Billable.aggregate(pipeline);
    res.json({ billedByUser: data });
  } catch (err) {
    console.error('getBilledStatsByUser error', err);
    res.status(500).json({ error: 'Failed to compute billed stats by user' });
  }
};



