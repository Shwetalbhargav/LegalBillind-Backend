// routes/aiRoutes.js
import express from 'express';
import { generateBillableSummary } from '../services/gptService.js';

const router = express.Router();

/**
 * POST /api/ai/generate-email
 * Body: { prompt: string }
 * Resp: { success, email: { text } }
 */
router.post('/generate-email', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, message: 'prompt (string) is required' });
    }

    // Use your GPT service (currently simple draft util)
    const text = [
      'Subject: Follow-up on your matter',
      '',
      `Hi there,`,
      '',
      `${prompt}`,
      '',
      'Please let me know if you have any questions.',
      '',
      'Best regards,',
      '— Your Name'
    ].join('\n');

    return res.json({ success: true, email: { text } });
  } catch (err) {
    console.error('[AI] generate-email failed:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/ai/email-to-billable
 * Turns an outbound email into a local billable preview.
 *
 * Body:
 * {
 *   userId: string,              // required
 *   to: string,                  // required (recipient email for matter mapping)
 *   subject?: string,
 *   body?: string,
 *   minutes?: number,            // default 6 (0.1h)
 *   date?: string,               // YYYY-MM-DD (defaults today)
 *   dryRun?: boolean             // kept for compatibility
 * }
 *
 * Resp:
 *   { success, planned: {...} }
 */
router.post('/email-to-billable', async (req, res) => {
  try {
    const {
      userId,
      to,
      subject = '',
      body = '',
      minutes = 6,
      date,         // optional YYYY-MM-DD
      dryRun = false
    } = req.body || {};

    // --- Validate inputs
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
    if (!to || typeof to !== 'string') {
      return res.status(400).json({ success: false, message: '"to" (recipient email) is required' });
    }
    const qtyHours = Math.max(Number(minutes ?? 6) / 60, 0.1);

    const description = await generateBillableSummary({ subject, body });
    return res.json({
      success: true,
      planned: {
        recipient: to,
        userId,
        quantityHours: qtyHours,
        description,
        date: date || new Date().toISOString().split('T')[0],
        dryRun: Boolean(dryRun),
      },
    });
  } catch (err) {
    const msg = (err?.response?.data && JSON.stringify(err.response.data)) || err.message || 'Unknown error';
    console.error('[AI] email-to-billable failed:', msg);
    return res.status(500).json({ success: false, message: msg });
  }
});

export default router;
