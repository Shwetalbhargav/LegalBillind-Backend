// src/routes/clioSync.js
import express from 'express';
import Billable from '../models/Billable.js';
import {Invoice} from '../models/Invoice.js';
import { pushTimeEntryToClio, pushInvoiceToClio } from '../services/clioService.js';
import { mapRecipientToMatter } from '../services/matterMapService.js';

const router = express.Router();

/**
 * Sync all unsynced billables to Clio as activities.
 */
router.post('/sync-billables', async (req, res) => {
  const userId = req.body.userId || 'demoUser';
  let syncedCount = 0;
  let skippedCount = 0;

  try {
    const unsynced = await Billable.find({ synced: { $ne: true } }).populate('clientId');

    for (const billable of unsynced) {
      const matterId = await mapRecipientToMatter(billable.clientId.contactInfo, userId);
      if (!matterId) {
        console.warn(`⚠️ No Clio Matter ID found for ${billable.clientId.contactInfo}`);
        skippedCount++;
        continue;
      }

      await pushTimeEntryToClio({
        userId,
        matterId,
        quantity: billable.hours,
        description: billable.description
      });

      billable.synced = true;
      await billable.save();
      syncedCount++;
    }

    res.json({ message: `✅ Synced ${syncedCount} billables to Clio, skipped ${skippedCount}` });
  } catch (err) {
    console.error('❌ Error syncing billables:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Sync all unsynced invoices to Clio as bills.
 */
router.post('/sync-invoices', async (req, res) => {
  const userId = req.body.userId || 'demoUser';
  let syncedCount = 0;
  let skippedCount = 0;

  try {
    const unsynced = await Invoice.find({ synced: { $ne: true } }).populate('clientId');

    for (const invoice of unsynced) {
      const matterId = await mapRecipientToMatter(invoice.clientId.contactInfo, userId);
      if (!matterId) {
        console.warn(`⚠️ No Clio Matter ID found for ${invoice.clientId.contactInfo}`);
        skippedCount++;
        continue;
      }

      const lineItems = invoice.items.map(i => ({
        description: i.description,
        quantity: i.durationMinutes / 60,
        rate: i.rate
      }));

      await pushInvoiceToClio({
        userId,
        matterId,
        lineItems
      });

      invoice.synced = true;
      await invoice.save();
      syncedCount++;
    }

    res.json({ message: `✅ Synced ${syncedCount} invoices to Clio, skipped ${skippedCount}` });
  } catch (err) {
    console.error('❌ Error syncing invoices:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
