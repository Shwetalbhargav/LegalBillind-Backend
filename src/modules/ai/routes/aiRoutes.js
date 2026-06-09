import express from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { Case } from '../../cases/models/Case.js';
import { generateBillableSummary } from '../services/gptService.js';
import { MatterDocument } from '../models/MatterDocument.js';
import {
  buildGeneratedDocument,
  buildMatterAnswer,
  retrieveMatterDocuments,
  summarizeText,
} from '../services/matterDocumentService.js';
import {
  validateAssist,
  validateEmailToBillable,
  validateGenerateDocument,
  validateGenerateEmail,
  validateMatterChat,
  validateMatterDocument,
} from '../validators/aiValidators.js';

const router = express.Router();

router.use(authenticate);

async function assertMatterAccess({ caseId, clientId }, req, res) {
  const matter = await Case.findById(caseId).select('clientId assignedUsers leadPartnerId managingLawyerId primaryLawyerId');
  if (!matter) {
    res.status(400).json({ success: false, message: 'caseId does not reference an existing matter' });
    return null;
  }
  if (clientId && String(matter.clientId) !== String(clientId)) {
    res.status(400).json({ success: false, message: 'clientId must match the selected matter client' });
    return null;
  }
  if (req.user?.role === 'admin' || req.user?.role === 'partner') return matter;
  const userId = String(req.user?.id || '');
  const assigned = [
    ...(matter.assignedUsers || []),
    matter.leadPartnerId,
    matter.managingLawyerId,
    matter.primaryLawyerId,
  ].some((value) => String(value || '') === userId);
  if (!assigned) {
    res.status(403).json({ success: false, message: 'You can only use AI on assigned matters' });
    return null;
  }
  return matter;
}

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
router.post('/generate-email', validateGenerateEmail, async (req, res) => {
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
 * POST /api/ai/assist
 * Global MVP assistant for app-wide drafting, summarization, research notes,
 * and billable narrative generation.
 */
router.post('/assist', validateAssist, async (req, res) => {
  try {
    const { mode, input, context = {} } = req.body || {};
    const cleanInput = String(input || '').trim();

    if (mode === 'draft_email') {
      const draft = buildEmailDraft(cleanInput);
      return res.json({
        success: true,
        mode,
        result: {
          title: draft.subject,
          text: [`Subject: ${draft.subject}`, '', ...draft.lines].join('\n'),
        },
        context,
      });
    }

    if (mode === 'billable_narrative') {
      const narrative = await generateBillableSummary({
        subject: context.subject || 'Billable work',
        body: cleanInput,
      });
      return res.json({
        success: true,
        mode,
        result: {
          title: 'Billable Narrative',
          text: narrative,
        },
        context,
      });
    }

    const sentences = cleanInput
      .split(/(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const summary = sentences.slice(0, mode === 'summarize_text' ? 3 : 5).join(' ') || cleanInput;
    const prefix = mode === 'analyze_text' ? 'Key analysis' : 'Summary';

    return res.json({
      success: true,
      mode,
      result: {
        title: prefix,
        text: `${prefix}: ${summary}`,
      },
      context,
    });
  } catch (err) {
    console.error('[AI] assist failed:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/matter-documents', async (req, res) => {
  try {
    const { caseId } = req.query;
    if (!caseId) return res.status(400).json({ success: false, message: 'caseId is required' });
    const matter = await assertMatterAccess({ caseId }, req, res);
    if (!matter) return;
    const rows = await MatterDocument.find({ caseId })
      .select('caseId clientId title documentType summary tags createdBy createdAt updatedAt')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[AI] list matter documents failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/matter-documents', validateMatterDocument, async (req, res) => {
  try {
    const matter = await assertMatterAccess(req.body, req, res);
    if (!matter) return;
    const doc = await MatterDocument.create({
      caseId: req.body.caseId,
      clientId: req.body.clientId || matter.clientId,
      title: req.body.title,
      documentType: req.body.documentType || 'other',
      content: req.body.content,
      summary: summarizeText(req.body.content),
      tags: Array.isArray(req.body.tags) ? req.body.tags.slice(0, 12) : [],
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error('[AI] create matter document failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/matter-chat', validateMatterChat, async (req, res) => {
  try {
    const matter = await assertMatterAccess({ caseId: req.body.caseId }, req, res);
    if (!matter) return;
    const documents = await retrieveMatterDocuments({
      caseId: req.body.caseId,
      question: req.body.question,
    });
    const result = buildMatterAnswer({ question: req.body.question, documents });
    res.json({ success: true, result });
  } catch (err) {
    console.error('[AI] matter-chat failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/generate-document', validateGenerateDocument, async (req, res) => {
  try {
    const matter = await assertMatterAccess(req.body, req, res);
    if (!matter) return;
    const documents = await retrieveMatterDocuments({
      caseId: req.body.caseId,
      question: req.body.instructions,
      limit: 6,
    });
    const generated = buildGeneratedDocument({
      documentType: req.body.documentType,
      instructions: req.body.instructions,
      sourceDocuments: documents,
    });
    res.json({
      success: true,
      result: {
        ...generated,
        citations: documents.map((doc) => ({
          documentId: String(doc._id),
          title: doc.title,
          documentType: doc.documentType,
        })),
      },
    });
  } catch (err) {
    console.error('[AI] generate-document failed:', err);
    res.status(500).json({ success: false, message: err.message });
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
router.post('/email-to-billable', validateEmailToBillable, async (req, res) => {
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
