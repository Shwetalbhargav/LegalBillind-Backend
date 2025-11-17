// src/controllers/arController.js
import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';

const asDate = (v) => (v ? new Date(v) : new Date());

export const ArController = {
  // GET /ar/aging
  // Optional: clientId, asOf (ISO date), clearedOnly=true|false
  async aging(req, res) {
    try {
      const { clientId, asOf, clearedOnly = 'true' } = req.query;
      const asOfDate = asDate(asOf);
      const paymentStatus = clearedOnly === 'false' ? undefined : 'cleared';

      const match = {
        status: { $in: ['sent', 'partial', 'overdue'] }
      };
      if (clientId) match.clientId = new mongoose.Types.ObjectId(clientId);

      const pipeline = [
        { $match: match },
        {
          $lookup: {
            from: 'payments',
            let: { invoiceId: '$_id' },
            pipeline: [
              { $match: {
                  $expr: { $eq: ['$invoiceId', '$$invoiceId'] },
                  ...(paymentStatus ? { status: paymentStatus } : {})
                }
              },
              { $group: { _id: null, paid: { $sum: '$amount' } } }
            ],
            as: 'paidAgg'
          }
        },
        {
          $addFields: {
            paidAmount: { $ifNull: [{ $first: '$paidAgg.paid' }, 0] },
            outstanding: {
              $max: [{ $subtract: ['$total', { $ifNull: [{ $first: '$paidAgg.paid' }, 0] }] }, 0]
            },
            daysPastDue: {
              $cond: [
                { $and: ['$dueDate', { $gt: ['$total', { $ifNull: [{ $first: '$paidAgg.paid' }, 0] }] }] },
                {
                  $dateDiff: {
                    startDate: '$dueDate',
                    endDate: asOfDate,
                    unit: 'day'
                  }
                },
                -1 // treat missing/ not past due as "current"
              ]
            }
          }
        },
        { $match: { outstanding: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            current: {
              $sum: { $cond: [{ $lte: ['$daysPastDue', 0] }, '$outstanding', 0] }
            },
            bkt_1_30: {
              $sum: {
                $cond: [
                  { $and: [{ $gte: ['$daysPastDue', 1] }, { $lte: ['$daysPastDue', 30] }] },
                  '$outstanding',
                  0
                ]
              }
            },
            bkt_31_60: {
              $sum: {
                $cond: [
                  { $and: [{ $gte: ['$daysPastDue', 31] }, { $lte: ['$daysPastDue', 60] }] },
                  '$outstanding',
                  0
                ]
              }
            },
            bkt_61_90: {
              $sum: {
                $cond: [
                  { $and: [{ $gte: ['$daysPastDue', 61] }, { $lte: ['$daysPastDue', 90] }] },
                  '$outstanding',
                  0
                ]
              }
            },
            bkt_90_plus: {
              $sum: { $cond: [{ $gt: ['$daysPastDue', 90] }, '$outstanding', 0] }
            },
            totalOutstanding: { $sum: '$outstanding' },
            invoiceCount: { $sum: 1 }
          }
        }
      ];

      const [row] = await Invoice.aggregate(pipeline);
      res.json({ ok: true, data: row || {
        current: 0, bkt_1_30: 0, bkt_31_60: 0, bkt_61_90: 0, bkt_90_plus: 0,
        totalOutstanding: 0, invoiceCount: 0
      }});
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  // GET /ar/aging/by-client
  async agingByClient(req, res) {
    try {
      const { asOf, clearedOnly = 'true' } = req.query;
      const asOfDate = asDate(asOf);
      const paymentStatus = clearedOnly === 'false' ? undefined : 'cleared';

      const pipeline = [
        { $match: { status: { $in: ['sent', 'partial', 'overdue'] } } },
        {
          $lookup: {
            from: 'payments',
            let: { invoiceId: '$_id' },
            pipeline: [
              { $match: {
                  $expr: { $eq: ['$invoiceId', '$$invoiceId'] },
                  ...(paymentStatus ? { status: paymentStatus } : {})
                }
              },
              { $group: { _id: null, paid: { $sum: '$amount' } } }
            ],
            as: 'paidAgg'
          }
        },
        {
          $addFields: {
            paidAmount: { $ifNull: [{ $first: '$paidAgg.paid' }, 0] },
            outstanding: {
              $max: [{ $subtract: ['$total', { $ifNull: [{ $first: '$paidAgg.paid' }, 0] }] }, 0]
            },
            daysPastDue: {
              $cond: [
                { $and: ['$dueDate', { $gt: ['$total', { $ifNull: [{ $first: '$paidAgg.paid' }, 0] }] }] },
                { $dateDiff: { startDate: '$dueDate', endDate: asOfDate, unit: 'day' } },
                -1
              ]
            }
          }
        },
        { $match: { outstanding: { $gt: 0 } } },
        {
          $group: {
            _id: '$clientId',
            current: { $sum: { $cond: [{ $lte: ['$daysPastDue', 0] }, '$outstanding', 0] } },
            bkt_1_30: { $sum: { $cond: [{ $and: [{ $gte: ['$daysPastDue', 1] }, { $lte: ['$daysPastDue', 30] }] }, '$outstanding', 0] } },
            bkt_31_60: { $sum: { $cond: [{ $and: [{ $gte: ['$daysPastDue', 31] }, { $lte: ['$daysPastDue', 60] }] }, '$outstanding', 0] } },
            bkt_61_90: { $sum: { $cond: [{ $and: [{ $gte: ['$daysPastDue', 61] }, { $lte: ['$daysPastDue', 90] }] }, '$outstanding', 0] } },
            bkt_90_plus: { $sum: { $cond: [{ $gt: ['$daysPastDue', 90] }, '$outstanding', 0] } },
            totalOutstanding: { $sum: '$outstanding' },
            invoiceCount: { $sum: 1 }
          }
        },
        { $sort: { totalOutstanding: -1 } }
      ];

      const rows = await Invoice.aggregate(pipeline);
      res.json({ ok: true, data: rows });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  }
};
