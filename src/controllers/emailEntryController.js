// src/controllers/emailEntryController.js
import mongoose from 'mongoose';
import { EmailEntry } from '../models/EmailEntry.js';
import { Activity } from '../models/Activity.js';
import { TimeEntry } from '../models/TimeEntry.js';
import { Case } from '../models/Case.js';
import { Client } from '../models/Client.js';
import User from '../models/User.js';
import { generateBillableSummary } from '../services/gptService.js';
import { pushTimeEntryToClio } from '../services/clioService.js';
import { mapRecipientToMatter } from '../services/matterMapService.js';

// ---------- helpers ----------
const oid = (v) => (mongoose.Types.ObjectId.isValid(String(v)) ? new mongoose.Types.ObjectId(v) : null);
const minutes = (m) => Math.max(Number(m || 0), 0);
const hours = (m) => Math.max(Number(m || 0) / 60, 0);
const cleanStr = (s, d='') => (typeof s === 'string' ? s : d);

// best-effort resolver to ensure we have client/case
async function ensureClientAndCase({ clientId, caseId, recipient }) {
  let client = clientId ? await Client.findById(clientId) : null;
  if (!client && recipient) {
    client = await Client.findOne({ email: recipient }) || await Client.findOne({ contactInfo: recipient });
    if (!client) {
      client = await Client.create({
        displayName: (recipient.split('@')[0] || 'Client').replace(/[^\w\s-]/g, ' ').trim(),
        email: recipient,
        contactInfo: recipient
      });
    }
  }
  if (!client) throw new Error('Unable to resolve client');

  let cse = caseId ? await Case.findById(caseId) : null;
  if (!cse) {
    cse = await Case.findOne({ clientId: client._id, status: { $in: ['open','pending'] } }) ||
          await Case.create({ clientId: client._id, title: 'General Matter', status: 'open' });
  }
  return { clientId: client._id, caseId: cse._id };
}

// ---------- create / read / list ----------
export const createEmailEntry = async (req, res) => {
  try {
    let { userId, userEmail, recipient, subject, body, typingTimeMinutes, billableSummary } = req.body || {};
    if (!recipient || !typingTimeMinutes) {
      return res.status(400).json({ ok: false, message: 'recipient and typingTimeMinutes are required' });
    }

    // resolve user by id or email
    if (!oid(userId)) {
      if (!userEmail) return res.status(400).json({ ok: false, message: 'userId or userEmail is required' });
      const u = await User.findOne({ email: String(userEmail).trim().toLowerCase() });
      if (!u) return res.status(400).json({ ok: false, message: 'user not found for userEmail' });
      userId = u._id;
    }

    const { clientId, caseId } = await ensureClientAndCase({ clientId: req.body.clientId, caseId: req.body.caseId, recipient });

    // GPT narrative fallback
    let narrative = cleanStr(billableSummary);
    if (!narrative && body) {
      try { narrative = await generateBillableSummary({ subject: cleanStr(subject,'(no subject)'), body }); }
      catch { /* keep default below */ }
    }
    if (!narrative) narrative = `Email work: ${cleanStr(subject,'(no subject)')}`;

    const entry = await EmailEntry.create({
      userId,
      userEmail,
      clientId,
      caseId,
      recipient,
      subject: cleanStr(subject,'(no subject)'),
      body: cleanStr(body),
      typingTimeMinutes: minutes(typingTimeMinutes),
      billableSummary: narrative,
      source: 'extension'
    });

    res.status(201).json({ ok: true, data: entry });
  } catch (err) {
    console.error('[EmailEntry create]', err);
    res.status(500).json({ ok: false, message: err.message || 'Server error' });
  }
};

export const getEmailEntryById = async (req, res) => {
  try {
    const entry = await EmailEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ ok: false, message: 'Not found' });
    res.json({ ok: true, data: entry });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const listEmailEntries = async (req, res) => {
  try {
    const { userId, userEmail, clientId, caseId, recipient, limit = 100, skip = 0 } = req.query;

    let resolvedUserId = oid(userId);
    if (!resolvedUserId && userEmail) {
      const u = await User.findOne({ email: String(userEmail).trim().toLowerCase() });
      if (u) resolvedUserId = u._id;
    }

    const q = {};
    if (resolvedUserId) q.userId = resolvedUserId;
    if (oid(clientId)) q.clientId = clientId;
    if (oid(caseId)) q.caseId = caseId;
    if (recipient) q.recipient = recipient;

    const data = await EmailEntry.find(q).sort({ createdAt: -1 }).skip(Number(skip)).limit(Math.min(Number(limit), 200));
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// ---------- update / delete ----------
export const updateEmailEntry = async (req, res) => {
  try {
    const allowed = ['recipient','subject','body','typingTimeMinutes','billableSummary','clientId','caseId'];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];

    if ('clientId' in patch || 'caseId' in patch || 'recipient' in patch) {
      const { clientId, caseId } = await ensureClientAndCase({
        clientId: patch.clientId ?? undefined,
        caseId: patch.caseId ?? undefined,
        recipient: patch.recipient ?? undefined
      });
      patch.clientId = clientId;
      patch.caseId = caseId;
    }

    const updated = await EmailEntry.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!updated) return res.status(404).json({ ok: false, message: 'Not found' });
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const deleteEmailEntry = async (req, res) => {
  try {
    const del = await EmailEntry.findByIdAndDelete(req.params.id);
    if (!del) return res.status(404).json({ ok: false, message: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// ---------- mapping to client/case ----------
export const mapEmailEntry = async (req, res) => {
  try {
    const { clientId, caseId } = req.body;
    if (!oid(clientId) && !oid(caseId)) {
      return res.status(400).json({ ok: false, message: 'clientId or caseId is required' });
    }
    const entry = await EmailEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ ok: false, message: 'Not found' });

    const resolved = await ensureClientAndCase({
      clientId: clientId ?? entry.clientId,
      caseId: caseId ?? entry.caseId,
      recipient: entry.recipient
    });

    entry.clientId = resolved.clientId;
    entry.caseId = resolved.caseId;
    await entry.save();

    res.json({ ok: true, data: entry });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

// ---------- GPT narrative (generate / regenerate) ----------
export const generateNarrative = async (req, res) => {
  try {
    const entry = await EmailEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ ok: false, message: 'Not found' });

    const narrative = await generateBillableSummary({
      subject: entry.subject || '(no subject)',
      body: entry.body || ''
    });

    entry.billableSummary = narrative;
    await entry.save();
    res.json({ ok: true, data: entry });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// ---------- Activity creation ----------
export const createActivityFromEmail = async (req, res) => {
  try {
    const entry = await EmailEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ ok: false, message: 'Not found' });

    const { clientId, caseId } = await ensureClientAndCase({
      clientId: entry.clientId,
      caseId: entry.caseId,
      recipient: entry.recipient
    });

    const activity = await Activity.create({
      userId: entry.userId,
      clientId,
      caseId,
      activityType: 'email',
      durationMinutes: minutes(entry.typingTimeMinutes),
      narrative: entry.billableSummary || `Email: ${entry.subject}`,
      source: 'extension',
      sourceRef: String(entry._id)
    });

    // keep a backlink in meta
    entry.meta = { ...(entry.meta || {}), activityId: activity._id };
    await entry.save();

    res.status(201).json({ ok: true, data: activity });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// ---------- TimeEntry creation ----------
export const createTimeEntryFromEmail = async (req, res) => {
  try {
    const entry = await EmailEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ ok: false, message: 'Not found' });

    const { clientId, caseId } = await ensureClientAndCase({
      clientId: entry.clientId,
      caseId: entry.caseId,
      recipient: entry.recipient
    });

    const billableMinutes = minutes(entry.typingTimeMinutes);
    const { status = 'submitted', rateApplied, date } = req.body || {};

    const timeEntry = await TimeEntry.create({
      userId: entry.userId,
      clientId,
      caseId,
      activityId: entry.meta?.activityId, // may be undefined
      narrative: entry.billableSummary || `Email: ${entry.subject}`,
      billableMinutes,
      nonbillableMinutes: 0,
      rateApplied: rateApplied ?? undefined,
      amount: rateApplied ? +(Number(rateApplied) * hours(billableMinutes)).toFixed(2) : undefined,
      date: date ? new Date(date) : new Date(),
      status
    });

    entry.meta = { ...(entry.meta || {}), timeEntryId: timeEntry._id };
    await entry.save();

    res.status(201).json({ ok: true, data: timeEntry });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// ---------- Clio push (existing behavior) ----------
export const pushEmailEntryToClio = async (req, res) => {
  try {
    const entry = await EmailEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ ok: false, message: 'Not found' });

    const matterId = await mapRecipientToMatter(entry.recipient, entry.userId);
    if (!matterId) return res.status(400).json({ ok: false, message: 'No Clio matter found for recipient' });

    const qty = Math.max(hours(entry.typingTimeMinutes), 0.1);
    const description = entry.billableSummary || entry.subject || 'Email work';

    const clioResp = await pushTimeEntryToClio({ userId: entry.userId, matterId, quantity: qty, description });
    const clioActivityId = clioResp?.data?.id || clioResp?.id || clioResp?.data?.data?.id || null;

    entry.meta = { ...(entry.meta || {}), clioPushed: true, clioActivityId, clioPushedAt: new Date() };
    await entry.save();

    res.json({ ok: true, data: { clioActivityId } });
  } catch (err) {
    console.error('[Clio push]', err);
    res.status(500).json({ ok: false, message: err.message });
  }
};

// ---------- optional: bulk ingest from extension ----------
export const bulkIngest = async (req, res) => {
  try {
    const { entries = [] } = req.body || {};
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ ok: false, message: 'entries[] is required' });
    }

    const results = [];
    for (const e of entries) {
      try {
        const { clientId, caseId } = await ensureClientAndCase({ clientId: e.clientId, caseId: e.caseId, recipient: e.recipient });
        const u =
          oid(e.userId) ? await User.findById(e.userId) :
          (e.userEmail ? await User.findOne({ email: String(e.userEmail).trim().toLowerCase() }) : null);
        if (!u) throw new Error('user not found');

        const doc = await EmailEntry.create({
          userId: u._id,
          userEmail: e.userEmail,
          clientId,
          caseId,
          recipient: e.recipient,
          subject: cleanStr(e.subject,'(no subject)'),
          body: cleanStr(e.body),
          typingTimeMinutes: minutes(e.typingTimeMinutes),
          billableSummary: cleanStr(e.billableSummary),
          source: 'extension'
        });
        results.push({ ok: true, id: doc._id });
      } catch (err) {
        results.push({ ok: false, error: err.message });
      }
    }
    res.status(207).json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};
