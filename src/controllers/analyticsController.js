//src/controllers/analyticsController.js
import mongoose from 'mongoose';

import Billable from '../models/Billable.js';
import {Invoice} from '../models/Invoice.js';
import {Client} from '../models/Client.js';
import User from '../models/User.js';

export const getBillableStats = async (req, res) => {
  try {
    const data = await Billable.aggregate([
      {
        $group: {
          _id: '$category',
          totalHours: { $sum: '$durationHours' },
          totalValue: { $sum: '$amount' }
        }
      }
    ]);
    res.json({ summaryByCategory: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute billable stats' });
  }
};

export const getInvoiceStats = async (req, res) => {
  try {
    const data = await Invoice.aggregate([
      {
        $group: {
          _id: '$status',
          totalRevenue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);
    res.json({ invoices: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute invoice stats' });
  }
};

export const getUnbilledBillables = async (req, res) => {
  try {
    const unbilled = await Billable.find({ synced: false });
    res.json({ count: unbilled.length, entries: unbilled });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get unbilled entries' });
  }
};

export const getBillableStatsByCaseType = async (req, res) => {
  try {
    const pipeline = [
      { $lookup: { from: 'cases', localField: 'caseId', foreignField: '_id', as: 'case' } },
      { $unwind: '$case' },
      // Optional filter: only a specific case type
      ...(req.query.caseType ? [{ $match: { 'case.case_type': req.query.caseType } }] : []),
      ...(req.query.caseTypeId ? [{ $match: { 'case.case_type_id': new mongoose.Types.ObjectId(req.query.caseTypeId) } }] : []),
      {
        $group: {
          _id: '$case.case_type',
          totalHours: { $sum: { $divide: ['$durationMinutes', 60] } },
          totalValue: { $sum: '$amount' },
          entries: { $sum: 1 }
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
    const matchStage = { synced: false };

    // Optional filter for a single client
    if (req.query.clientId) {
      matchStage.clientId = new mongoose.Types.ObjectId(req.query.clientId);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$clientId',
          totalUnbilledHours: { $sum: { $divide: ['$durationMinutes', 60] } },
          totalUnbilledValue: { $sum: '$amount' },
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
    const matchStage = { synced: false };

    // Optional filter for a single user/lawyer
    if (req.query.userId) {
      matchStage.userId = new mongoose.Types.ObjectId(req.query.userId);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$userId',
          totalUnbilledHours: { $sum: { $divide: ['$durationMinutes', 60] } },
          totalUnbilledValue: { $sum: '$amount' },
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
    const matchStage = { synced: true }; // <-- change this if your "billed" flag is different

    // Optional filter for a single client
    if (req.query.clientId) {
      matchStage.clientId = new mongoose.Types.ObjectId(req.query.clientId);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$clientId',
          totalHours: { $sum: '$durationHours' },
          totalValue: { $sum: '$amount' },
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
    const matchStage = { synced: true }; // <-- same note: adjust to your "billed" criteria

    // Optional filter for a single user
    if (req.query.userId) {
      matchStage.userId = new mongoose.Types.ObjectId(req.query.userId);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$userId',
          totalHours: { $sum: '$durationHours' },
          totalValue: { $sum: '$amount' },
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



