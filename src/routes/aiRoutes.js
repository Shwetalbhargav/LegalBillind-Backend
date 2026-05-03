// routes/aiRoutes.js
import express from 'express';
import { generateBillableSummary } from '../services/gptService.js';

const router = express.Router();

function titleCase(value = '') {
  return String(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function sanitizePrompt(prompt = '') {
  return String(prompt)
    .replace(/^write\s+(an?|the)\s+/i, '')
    .replace(/^draft\s+(an?|the)\s+/i, '')
    .replace(/^compose\s+(an?|the)\s+/i, '')
    .replace(/^email\s+(for|to)\s+/i, '')
    .trim();
}

function buildEmailDraft(prompt = '') {
  const cleaned = sanitizePrompt(prompt);
  const lower = cleaned.toLowerCase();

  if (lower.includes('birthday')) {
    return {
      subject: 'Happy Birthday',
      lines: [
        'Hi,',
        '',
        'Wishing you a very happy birthday and a wonderful year ahead.',
        'I hope your day is filled with happiness, good health, and success.',
        '',
        'Warm wishes,',
        'Your Name'
      ]
    };
  }

  if (lower.includes('interview') && lower.includes('confirmation')) {
    const role = cleaned.replace(/.*confirmation\s+for\s+/i, '').trim();
    const roleText = role ? titleCase(role) : 'the interview';
    return {
      subject: `Interview Confirmation${role ? ` - ${roleText}` : ''}`,
      lines: [
        'Hi,',
        '',
        `This email is to confirm your interview${role ? ` for the ${roleText} role` : ''}.`,
        'Please let us know if you need any clarification before the scheduled discussion.',
        '',
        'Best regards,',
        'Your Name'
      ]
    };
  }

  if (lower.includes('invitation')) {
    const eventText = cleaned.replace(/^invitation\s+(for|to)\s+/i, '').trim() || 'our event';
    return {
      subject: `Invitation - ${titleCase(eventText)}`,
      lines: [
        'Hi,',
        '',
        `You are warmly invited to ${eventText}.`,
        'We would be delighted to have you join us.',
        '',
        'Best regards,',
        'Your Name'
      ]
    };
  }

  if (lower.includes('promotion')) {
    return {
      subject: 'Invitation to Promotion Celebration',
      lines: [
        'Hi,',
        '',
        'I am happy to invite you to our promotion celebration.',
        'It would mean a lot to have you there and celebrate this occasion together.',
        '',
        'Best regards,',
        'Your Name'
      ]
    };
  }

  if (lower.includes('invoice')) {
    return {
      subject: 'Invoice Follow-Up',
      lines: [
        'Hi,',
        '',
        'I am writing to follow up regarding the invoice and to check if anything further is needed from my side.',
        'Please let me know if you need any clarification or supporting details.',
        '',
        'Best regards,',
        'Your Name'
      ]
    };
  }

  const message = cleaned || 'following up with you';
  const subject = titleCase(message.replace(/[.?!]+$/g, '').slice(0, 80)) || 'Follow-Up';
  return {
    subject,
    lines: [
      'Hi,',
      '',
      `${message.charAt(0).toUpperCase()}${message.slice(1)}.`,
      '',
      'Please let me know if you have any questions.',
      '',
      'Best regards,',
      'Your Name'
    ]
  };
}

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

    const draft = buildEmailDraft(prompt);
    const text = [
      `Subject: ${draft.subject}`,
      '',
      ...draft.lines
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
 *   userId: string,
 *   to: string,
 *   subject?: string,
 *   body?: string,
 *   minutes?: number,
 *   date?: string,
 *   dryRun?: boolean
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
      date,
      dryRun = false
    } = req.body || {};

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
