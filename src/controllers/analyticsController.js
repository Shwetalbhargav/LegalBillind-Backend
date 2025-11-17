//src/controllers/analyticsController.js
import mongoose from 'mongoose';

import Billable from '../models/Billable.js';
import {Invoice} from '../models/Invoice.js';

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


