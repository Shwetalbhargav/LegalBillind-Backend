
import Billable from '../models/Billable.js';
import Invoice from '../models/Invoice.js';

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


