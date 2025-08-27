// controllers/emailEntryController.js
import EmailEntry from '../models/EmailEntry.js';
import User from '../models/User.js';
import Client from '../models/Client.js';
import Case from '../models/Case.js';
import { generateBillableSummary } from '../services/gptService.js';
import { pushTimeEntryToClio } from '../services/clioService.js';
import { mapRecipientToMatter } from '../services/matterMapService.js';
import mongoose from 'mongoose';

// Resolve (or create) a Client + an active Case for this recipient.
async function resolveClientAndCase(recipient) {
  let client = await Client.findOne({ email: recipient }) || await Client.findOne({ contactInfo: recipient });
  if (!client) {
    client = await Client.create({
      name: (recipient.split('@')[0] || 'Client').replace(/[^\w\s-]/g, ' ').trim(),
      email: recipient,
      contactInfo: recipient,
      active: true,
    });
  }

  let caseDoc =
    (await Case.findOne({ clientId: client._id, isActive: true })) ||
    (await Case.findOne({ clientId: client._id }));

  if (!caseDoc) {
    caseDoc = await Case.create({
      clientId: client._id,
      name: 'General Matter',
      isActive: true,
    });
  }

  return { clientId: client._id, caseId: caseDoc._id };
}

export const createEmailEntry = async (req, res) => {
  try {
    let { userId, userEmail, recipient, subject, body, typingTimeMinutes, billableSummary } = req.body || {};

    // --- Validate required fields (schema requires all of these) ---
    if (!recipient || !typingTimeMinutes) {
      return res.status(400).json({ success: false, error: 'Missing recipient or typingTimeMinutes' });
    }
    subject = subject || '(no subject)';
    // ---------- NEW: resolve userId from userEmail BEFORE validation ----------
    const hasValidId = userId && mongoose.Types.ObjectId.isValid(String(userId));
    if (!hasValidId) {
      // require *some* identity
      if (!userEmail) {
        return res.status(400).json({ success: false, error: "Missing userEmail or userId" });
      }

    // normalize and look up
      const email = String(userEmail).trim().toLowerCase();
      let user = await User.findOne({ email });

      // optional: auto-create a stub user so capture never blocks
      if (!user) {
        user = await User.create({
          email,
          name: email.split("@")[0],
          role: "staff",                 // pick a sensible default
          billingRate: 0                 // or your org default
        });
      }
      userId = user._id; // <- fill it in for the rest of the flow
    }

    // Validate userId is a real ObjectId
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ success: false, error: 'Missing or invalid userId (set userEmail or userId)' });
    }

    // Ensure we have clientId/caseId (required by the schema)
    const { clientId, caseId } = await resolveClientAndCase(recipient);

    // Generate a summary if none provided and we have a body
    let summary = billableSummary;
    if (!summary && body) {
      try {
        summary = await generateBillableSummary({ subject, body });
      } catch {
        /* fall back to default below */
      }
    }
    if (!summary) summary = `Drafting email to ${recipient}${subject ? ` re: ${subject}` : ''}`;

    // --- Save entry (schema requires: userId, clientId, caseId, recipient, subject, typingTimeMinutes) ---
    // controllers/emailEntryController.js (inside createEmailEntry, after you computed `summary`)

const entry = await EmailEntry.create({
  userId,
  clientId,
  caseId,
  recipient,
  subject,
  typingTimeMinutes: Number(typingTimeMinutes),
  billableSummary: summary,
});

// --- Push to Clio and PERSIST result in Mongo ---
try {
  const qty = Math.max(Number(typingTimeMinutes) / 60, 0.1);
  const matterId = await mapRecipientToMatter(recipient, userId);
  if (!matterId) throw new Error('No Clio matter found for recipient');

  // push; service returns Clio’s response body
  const clioResp = await pushTimeEntryToClio({
    userId,
    matterId,
    quantity: qty,
    description: summary,
    // date: optional (defaults in service)
  });

  // capture useful identifiers (if present) + timestamp
  const clioActivityId =
    clioResp?.data?.id || clioResp?.id || clioResp?.data?.data?.id || null;

  entry.meta = {
    ...(entry.meta || {}),
    clioPushed: true,
    clioActivityId,
    clioPushedAt: new Date(),
  };
} catch (pushErr) {
  console.warn('[Clio push warning]', pushErr?.response?.status, pushErr?.response?.data || pushErr?.message);

  entry.meta = {
    ...(entry.meta || {}),
    clioPushed: false,
    clioError: pushErr?.response?.data || pushErr?.message || 'Unknown error',
    clioPushedAt: new Date(),
  };
}

// PERSIST meta no matter what
await entry.save();

 
 const saved = await EmailEntry.findById(entry._id).populate('clientId','name').populate('caseId','name');
 return res.status(201).json({ success: true, entry: toView(saved) });

  } catch (err) {
    console.error('[EmailEntry create error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
};



export const getEmailEntryById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, error: 'Invalid id' });
    }
    const entry = await EmailEntry.findById(id);
    if (!entry) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json(entry);
  } catch (err) {
    console.error('[EmailEntry get error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
};

export const listEmailEntries = async (req, res) => {
  try {
    const { userId: rawUserId, userEmail, recipient, clientId, caseId, timeMin, timeMax, limit, skip } = req.query;

    // Normalize and optionally resolve userId via userEmail (mirror create flow)
    let userId = rawUserId && mongoose.Types.ObjectId.isValid(String(rawUserId)) ? rawUserId : undefined;
    if (!userId && userEmail) {
      const user = await User.findOne({ email: String(userEmail).trim().toLowerCase() });
      if (user) userId = user._id;
    }

    const filter = {};
    if (userId) filter.userId = userId;
    if (recipient) filter.recipient = recipient;
    if (clientId && mongoose.Types.ObjectId.isValid(String(clientId))) filter.clientId = clientId;
    if (caseId && mongoose.Types.ObjectId.isValid(String(caseId))) filter.caseId = caseId;

    // optional createdAt window
    if (timeMin || timeMax) {
      filter.createdAt = {};
      if (timeMin) filter.createdAt.$gte = new Date(timeMin);
      if (timeMax) filter.createdAt.$lte = new Date(timeMax);
    }

    const query = EmailEntry.find(filter).sort({ createdAt: -1 });
    if (skip) query.skip(Number(skip));
    if (limit) query.limit(Math.min(Number(limit), 200));

    const entries = await query.exec();

    // Return a raw array to match slices that expect `[]` for GET lists
    return res.json(entries);
  } catch (err) {
    console.error('[EmailEntry list error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
};

// controllers/emailEntryController.js
function toView(e) {
  const clientName = e?.clientId?.name || e?.client?.name || null;
  const caseName   = e?.caseId?.name   || e?.case?.name   || e?.case?.title || null;

  return {
    _id: e._id,
    userId: e.userId,
    clientId: e.clientId?._id || e.clientId,
    caseId: e.caseId?._id || e.caseId,
    recipient: e.recipient,
    subject: e.subject,
    typingTimeMinutes: e.typingTimeMinutes,
    billableSummary: e.billableSummary,
    workDate: e.workDate,
    rate: e.rate,
    createdAt: e.createdAt,
    clientName,
    caseName,
    meta: e.meta || {}
  };
}

export const pushEmailEntryToClio = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, error: 'Invalid id' });
    }

    const entry = await EmailEntry.findById(id);
    if (!entry) return res.status(404).json({ success: false, error: 'Not found' });

    const qty = Math.max(Number(entry.typingTimeMinutes || 0) / 60, 0.1);
    const description = entry.billableSummary || entry.subject || 'Email work';
    const matterId = await mapRecipientToMatter(entry.recipient, entry.userId);
    if (!matterId) {
      entry.meta = { ...(entry.meta || {}), clioPushed: false, clioError: 'No Clio matter found', clioPushedAt: new Date() };
      await entry.save();
      return res.status(400).json({ success: false, error: 'No Clio matter found for recipient' });
    }

    const clioResp = await pushTimeEntryToClio({
      userId: entry.userId,
      matterId,
      quantity: qty,
      description
    });

    const clioActivityId = clioResp?.data?.id || clioResp?.id || clioResp?.data?.data?.id || null;

    entry.meta = { ...(entry.meta || {}), clioPushed: true, clioActivityId, clioPushedAt: new Date() };
    await entry.save();

    const saved = await EmailEntry.findById(entry._id).populate('clientId','name').populate('caseId','name');
    return res.json({ success: true, entry: {
      _id: saved._id,
      userId: saved.userId,
      clientId: saved.clientId?._id || saved.clientId,
      caseId: saved.caseId?._id || saved.caseId,
      recipient: saved.recipient,
      subject: saved.subject,
      typingTimeMinutes: saved.typingTimeMinutes,
      billableSummary: saved.billableSummary,
      workDate: saved.workDate,
      rate: saved.rate,
      createdAt: saved.createdAt,
      clientName: saved.clientId?.name || null,
      caseName: saved.caseId?.name || null,
      meta: saved.meta || {}
    }});
  } catch (err) {
    console.error('[EmailEntry push error]', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
};