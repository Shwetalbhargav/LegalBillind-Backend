import mongoose from 'mongoose';
import { EmailEntry } from '../models/EmailEntry.js';
import { Activity } from '../../activities/models/Activity.js';
import { TimeEntry } from '../../timeEntries/models/TimeEntry.js';
import Billable from '../../billables/models/Billable.js';
import { Case } from '../../cases/models/Case.js';
import { Client } from '../../clients/models/Client.js';
import User from '../../users/models/User.js';
import { generateBillableSummary } from '../../ai/services/gptService.js';
import { ensureCaseInZoho, ensureClientInZoho } from '../../integrations/services/zohoCrmService.js';
import {
  convertEmailEntryToBillingRecords,
  ensureActivityForCapture,
  runEmailEntryTransaction,
} from '../services/emailEntryConversionService.js';

const SOURCE_VALUES = ['gmail', 'extension', 'research'];
const BULK_LIMIT = 100;

const oid = (value) => (
  mongoose.Types.ObjectId.isValid(String(value || ''))
    ? new mongoose.Types.ObjectId(value)
    : null
);
const cleanStr = (value, fallback = '') => (typeof value === 'string' ? value.trim() : fallback);
const minutes = (value) => Math.max(Number(value || 0), 0);
const withSession = (query, session) =>
  session && query && typeof query.session === 'function' ? query.session(session) : query;

function normalizeSource(value) {
  const source = String(value || '').trim().toLowerCase();
  return SOURCE_VALUES.includes(source) ? source : 'extension';
}

function normalizeDomain({ domain, url }) {
  const explicit = cleanStr(domain).toLowerCase().replace(/^www\./, '');
  if (explicit) return explicit;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function getDurationMinutes(payload = {}) {
  if (payload.typingTimeMinutes != null) return minutes(payload.typingTimeMinutes);
  if (payload.durationMinutes != null) return minutes(payload.durationMinutes);
  if (payload.minutes != null) return minutes(payload.minutes);
  if (payload.typingTimeSeconds != null) return minutes(payload.typingTimeSeconds) / 60;
  return 0;
}

function getEntryStatusForMapping(entry, { clientId, caseId }) {
  if (entry?.status === 'converted' || entry?.status === 'billed') return entry.status;
  return clientId && caseId ? 'mapped' : 'captured';
}

async function resolveCaptureUser(req, payload = {}, session) {
  const requestedUserId = oid(payload.userId);
  if (req.user?.id) {
    if (requestedUserId && String(requestedUserId) !== String(req.user.id) && req.user.role !== 'admin') {
      const error = new Error('Only admins can create email entries for another user');
      error.statusCode = 403;
      throw error;
    }
    return requestedUserId && req.user.role === 'admin' ? requestedUserId : oid(req.user.id);
  }

  if (requestedUserId) return requestedUserId;
  const userEmail = cleanStr(payload.userEmail).toLowerCase();
  if (!userEmail) {
    const error = new Error('userId or userEmail is required');
    error.statusCode = 400;
    throw error;
  }
  const user = await withSession(User.findOne({ email: userEmail }), session);
  if (!user) {
    const error = new Error('user not found for userEmail');
    error.statusCode = 400;
    throw error;
  }
  return user._id;
}

async function resolveExplicitClientAndCase({ clientId, caseId }, session) {
  let client = null;
  let matter = null;

  if (clientId) {
    const clientObjectId = oid(clientId);
    if (!clientObjectId) throw new Error('clientId must be a valid ObjectId');
    client = await withSession(Client.findById(clientObjectId), session);
    if (!client) throw new Error('Client not found');
  }

  if (caseId) {
    const caseObjectId = oid(caseId);
    if (!caseObjectId) throw new Error('caseId must be a valid ObjectId');
    matter = await withSession(Case.findById(caseObjectId), session);
    if (!matter) throw new Error('Matter not found');
  }

  if (matter && client && String(matter.clientId) !== String(client._id)) {
    throw new Error('caseId does not belong to clientId');
  }

  if (matter && !client) {
    client = await withSession(Client.findById(matter.clientId), session);
    if (!client) throw new Error('Matter client not found');
  }

  return {
    clientId: client?._id,
    caseId: matter?._id,
  };
}

async function buildNarrative(payload, { subject, body, source }) {
  const explicit = cleanStr(payload.billableSummary);
  if (explicit) return explicit;
  if (source !== 'research' && body) {
    try {
      return await generateBillableSummary({ subject, body });
    } catch {
      // Fall through to a deterministic narrative.
    }
  }
  return source === 'research' ? `Research work: ${subject}` : `Email work: ${subject}`;
}

async function upsertEmailEntryFromPayload(req, payload = {}, { session } = {}) {
  const userId = await resolveCaptureUser(req, payload, session);
  const source = normalizeSource(payload.source);
  const sourceRef = cleanStr(payload.sourceRef);
  const mapping = await resolveExplicitClientAndCase({
    clientId: payload.clientId || payload.mappedClientId,
    caseId: payload.caseId || payload.mappedCaseId,
  }, session);

  const domain = normalizeDomain({ domain: payload.domain, url: payload.url });
  const subject = cleanStr(
    payload.subject,
    source === 'research' ? 'Research capture' : '(no subject)'
  );
  const body = cleanStr(payload.body || payload.selectedText);
  const durationMinutes = getDurationMinutes(payload);
  const recipient = cleanStr(
    payload.recipient,
    source === 'research' ? domain || 'research' : ''
  );

  if (source !== 'research' && !recipient) {
    const error = new Error('recipient is required for email capture');
    error.statusCode = 400;
    throw error;
  }
  if (durationMinutes <= 0) {
    const error = new Error('duration is required');
    error.statusCode = 400;
    throw error;
  }

  if (sourceRef) {
    const existing = await withSession(
      EmailEntry.findOne({ userId, source, sourceRef }),
      session
    );
    if (existing) {
      const existingStatus = existing.status;
      if (mapping.clientId) existing.clientId = mapping.clientId;
      if (mapping.caseId) existing.caseId = mapping.caseId;
      if (mapping.clientId && mapping.caseId && existing.status === 'captured') {
        existing.status = 'mapped';
        existing.mappedAt = existing.mappedAt || new Date();
      }
      existing.meta = {
        ...(existing.meta || {}),
        ...(payload.meta || {}),
        idempotentReplayAt: new Date(),
      };
      await existing.save(session ? { session } : undefined);
      return { entry: existing, idempotent: true, previousStatus: existingStatus };
    }
  }

  const narrative = await buildNarrative(payload, { subject, body, source });
  const workDate = payload.workDate ? new Date(payload.workDate) : new Date();
  const status = mapping.clientId && mapping.caseId ? 'mapped' : 'captured';
  const [entry] = await EmailEntry.create([{
    userId,
    userEmail: cleanStr(payload.userEmail || req.user?.email).toLowerCase(),
    recipient,
    subject,
    body,
    typingTimeMinutes: durationMinutes,
    typingTimeSeconds: payload.typingTimeSeconds ?? Math.round(durationMinutes * 60),
    typingTimeMinSec: cleanStr(payload.typingTimeMinSec),
    clientId: mapping.clientId,
    caseId: mapping.caseId,
    mappedClientId: mapping.clientId,
    mappedCaseId: mapping.caseId,
    billableSummary: narrative,
    workDate,
    rate: payload.rate,
    source,
    sourceRef: sourceRef || undefined,
    messageId: cleanStr(payload.messageId),
    threadId: cleanStr(payload.threadId),
    url: cleanStr(payload.url),
    domain,
    status,
    mappedAt: status === 'mapped' ? new Date() : undefined,
    schemaVersion: Number(payload.schemaVersion || payload.meta?.schemaVersion || 1),
    meta: {
      ...(payload.meta || {}),
      captureSource: source,
    },
  }], session ? { session } : undefined);

  return { entry, idempotent: false };
}

const populateEmailEntry = (query) => query
  .populate('clientId', 'displayName name email')
  .populate('caseId', 'title name status clientId')
  .populate('userId', 'name email role');

function buildOpsFilter(req) {
  const filter = {};
  if (req.user?.role !== 'admin') filter.userId = oid(req.user?.id);
  if (req.query?.userId && req.user?.role === 'admin') filter.userId = oid(req.query.userId);
  if (req.query?.source) filter.source = req.query.source;
  if (req.query?.from || req.query?.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }
  return filter;
}

export const getEmailEntryMetrics = async (req, res) => {
  try {
    const filter = buildOpsFilter(req);
    const [
      byStatus,
      bySource,
      idempotentReplays,
      conversionFailures,
      bulkFailures,
      unmappedCount,
      mappedUnconvertedCount,
    ] = await Promise.all([
      EmailEntry.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      EmailEntry.aggregate([
        { $match: filter },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      EmailEntry.countDocuments({ ...filter, 'meta.idempotentReplayAt': { $exists: true } }),
      EmailEntry.countDocuments({ ...filter, status: 'mapped', clientId: { $exists: true }, caseId: { $exists: true } }),
      EmailEntry.countDocuments({ ...filter, 'meta.bulkIngestFailed': true }),
      EmailEntry.countDocuments({
        ...filter,
        status: 'captured',
        $or: [{ clientId: { $exists: false } }, { caseId: { $exists: false } }],
      }),
      EmailEntry.countDocuments({
        ...filter,
        status: 'mapped',
        $or: [
          { 'meta.activityId': { $exists: false } },
          { 'meta.timeEntryId': { $exists: false } },
          { 'meta.billableId': { $exists: false } },
        ],
      }),
    ]);

    res.json({
      ok: true,
      data: {
        byStatus,
        bySource,
        idempotentReplays,
        conversionFailures,
        bulkFailures,
        reconciliation: {
          capturedUnmapped: unmappedCount,
          mappedUnconverted: mappedUnconvertedCount,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const reconcileEmailEntries = async (req, res) => {
  try {
    const filter = buildOpsFilter(req);
    const limit = Math.min(Number(req.query.limit || 100), 500);

    const [
      capturedUnmapped,
      mappedUnconverted,
      convertedCandidates,
      duplicateSourceRefs,
    ] = await Promise.all([
      EmailEntry.find({
        ...filter,
        status: 'captured',
        $or: [{ clientId: { $exists: false } }, { caseId: { $exists: false } }],
      }).limit(limit).select('_id subject source sourceRef status clientId caseId createdAt'),
      EmailEntry.find({
        ...filter,
        status: 'mapped',
        clientId: { $exists: true },
        caseId: { $exists: true },
        $or: [
          { 'meta.activityId': { $exists: false } },
          { 'meta.timeEntryId': { $exists: false } },
          { 'meta.billableId': { $exists: false } },
        ],
      }).limit(limit).select('_id subject source sourceRef status clientId caseId meta createdAt'),
      EmailEntry.find({
        ...filter,
        status: 'converted',
      }).limit(limit).select('_id subject source sourceRef status clientId caseId meta createdAt'),
      EmailEntry.aggregate([
        { $match: { ...filter, sourceRef: { $exists: true, $type: 'string' } } },
        { $group: { _id: { userId: '$userId', source: '$source', sourceRef: '$sourceRef' }, ids: { $push: '$_id' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: limit },
      ]),
    ]);

    const convertedMissingLinks = [];
    for (const entry of convertedCandidates) {
      const [activity, timeEntry, billable] = await Promise.all([
        entry.meta?.activityId ? Activity.exists({ _id: entry.meta.activityId }) : null,
        entry.meta?.timeEntryId ? TimeEntry.exists({ _id: entry.meta.timeEntryId }) : null,
        entry.meta?.billableId ? Billable.exists({ _id: entry.meta.billableId }) : null,
      ]);
      if (!activity || !timeEntry || !billable) {
        convertedMissingLinks.push({
          _id: entry._id,
          subject: entry.subject,
          source: entry.source,
          sourceRef: entry.sourceRef,
          missing: {
            activity: !activity,
            timeEntry: !timeEntry,
            billable: !billable,
          },
        });
      }
    }

    res.json({
      ok: true,
      data: {
        capturedUnmapped,
        mappedUnconverted,
        convertedMissingLinks,
        duplicateSourceRefs,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const repairEmailEntry = async (req, res) => {
  try {
    const result = await runEmailEntryTransaction(async (session) => {
      const entry = await withSession(EmailEntry.findById(req.params.id), session);
      if (!entry) {
        const error = new Error('Not found');
        error.statusCode = 404;
        throw error;
      }
      if (req.user?.role !== 'admin' && String(entry.userId) !== String(req.user?.id)) {
        const error = new Error('You can only repair your own email entries');
        error.statusCode = 403;
        throw error;
      }
      if (!entry.clientId || !entry.caseId) {
        const error = new Error('Email entry must be mapped before repair');
        error.statusCode = 422;
        throw error;
      }
      return convertEmailEntryToBillingRecords(entry, {
        body: req.body || {},
        actorId: req.user?.id,
        session,
      });
    });

    res.json({
      ok: true,
      data: result.entry,
      activity: result.activity,
      timeEntry: result.timeEntry,
      billable: result.billable,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, message: err.message });
  }
};

// ---------- create / read / list ----------
export const createEmailEntry = async (req, res) => {
  try {
    const result = await runEmailEntryTransaction(async (session) => {
      const capture = await upsertEmailEntryFromPayload(req, req.body || {}, { session });
      if (req.body?.autoConvert) {
        const converted = await convertEmailEntryToBillingRecords(capture.entry, {
          body: req.body || {},
          actorId: req.user?.id,
          session,
        });
        return { ...capture, ...converted };
      }
      return capture;
    });

    res.status(result.idempotent ? 200 : 201).json({
      ok: true,
      data: result.entry,
      idempotent: !!result.idempotent,
      ...(result.activity ? { activity: result.activity } : {}),
      ...(result.timeEntry ? { timeEntry: result.timeEntry } : {}),
      ...(result.billable ? { billable: result.billable } : {}),
    });
  } catch (err) {
    if (err?.code === 11000 && req.body?.sourceRef) {
      const source = normalizeSource(req.body.source);
      const userId = req.user?.id;
      const existing = userId
        ? await EmailEntry.findOne({ userId, source, sourceRef: req.body.sourceRef })
        : null;
      if (existing) return res.json({ ok: true, data: existing, idempotent: true });
    }

    console.error('[EmailEntry create]', err);
    res.status(err.statusCode || 500).json({ ok: false, message: err.message || 'Server error' });
  }
};

export const getEmailEntryById = async (req, res) => {
  try {
    const entry = await populateEmailEntry(EmailEntry.findById(req.params.id));
    if (!entry) return res.status(404).json({ ok: false, message: 'Not found' });
    if (req.user?.role !== 'admin' && String(entry.userId?._id || entry.userId) !== String(req.user?.id)) {
      return res.status(403).json({ ok: false, message: 'You can only access your own email entries' });
    }
    res.json({ ok: true, data: entry });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const listEmailEntries = async (req, res) => {
  try {
    const {
      userId,
      userEmail,
      clientId,
      caseId,
      recipient,
      source,
      status,
      domain,
      limit = 100,
      skip = 0,
    } = req.query;

    let resolvedUserId = req.user?.role === 'admin' ? oid(userId) : oid(req.user?.id);
    if (!resolvedUserId && req.user?.role === 'admin' && userEmail) {
      const user = await User.findOne({ email: String(userEmail).trim().toLowerCase() });
      if (user) resolvedUserId = user._id;
    }

    const q = {};
    if (resolvedUserId) q.userId = resolvedUserId;
    if (oid(clientId)) q.clientId = clientId;
    if (oid(caseId)) q.caseId = caseId;
    if (recipient) q.recipient = recipient;
    if (source) q.source = source;
    if (status) q.status = status;
    if (domain) q.domain = String(domain).trim().toLowerCase().replace(/^www\./, '');

    const data = await populateEmailEntry(
      EmailEntry.find(q)
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Math.min(Number(limit), 200))
    );
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// ---------- update / delete ----------
export const updateEmailEntry = async (req, res) => {
  try {
    const entry = await EmailEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ ok: false, message: 'Not found' });
    if (req.user?.role !== 'admin' && String(entry.userId) !== String(req.user?.id)) {
      return res.status(403).json({ ok: false, message: 'You can only update your own email entries' });
    }

    const allowed = [
      'recipient',
      'subject',
      'body',
      'typingTimeMinutes',
      'typingTimeSeconds',
      'typingTimeMinSec',
      'billableSummary',
      'clientId',
      'caseId',
      'sourceRef',
      'messageId',
      'threadId',
      'url',
      'domain',
      'workDate',
      'rate',
      'meta',
    ];
    for (const field of allowed) {
      if (field in req.body) entry[field] = req.body[field];
    }

    if ('clientId' in req.body || 'caseId' in req.body) {
      const mapping = await resolveExplicitClientAndCase({
        clientId: req.body.clientId ?? entry.clientId,
        caseId: req.body.caseId ?? entry.caseId,
      });
      entry.clientId = mapping.clientId;
      entry.caseId = mapping.caseId;
      entry.mappedClientId = mapping.clientId;
      entry.mappedCaseId = mapping.caseId;
      entry.status = getEntryStatusForMapping(entry, mapping);
      if (entry.status === 'mapped') entry.mappedAt = entry.mappedAt || new Date();
    }

    await entry.save();
    res.json({ ok: true, data: entry });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const deleteEmailEntry = async (req, res) => {
  try {
    const entry = await EmailEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ ok: false, message: 'Not found' });
    if (req.user?.role !== 'admin' && String(entry.userId) !== String(req.user?.id)) {
      return res.status(403).json({ ok: false, message: 'You can only delete your own email entries' });
    }
    await entry.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// ---------- mapping to client/case ----------
export const mapEmailEntry = async (req, res) => {
  try {
    const result = await runEmailEntryTransaction(async (session) => {
      const entry = await withSession(EmailEntry.findById(req.params.id), session);
      if (!entry) {
        const error = new Error('Not found');
        error.statusCode = 404;
        throw error;
      }
      if (req.user?.role !== 'admin' && String(entry.userId) !== String(req.user?.id)) {
        const error = new Error('You can only map your own email entries');
        error.statusCode = 403;
        throw error;
      }

      const mapping = await resolveExplicitClientAndCase({
        clientId: req.body.clientId ?? entry.clientId,
        caseId: req.body.caseId ?? entry.caseId,
      }, session);
      if (!mapping.clientId || !mapping.caseId) {
        const error = new Error('clientId and caseId are required');
        error.statusCode = 400;
        throw error;
      }

      entry.clientId = mapping.clientId;
      entry.caseId = mapping.caseId;
      entry.mappedClientId = mapping.clientId;
      entry.mappedCaseId = mapping.caseId;
      entry.status = getEntryStatusForMapping(entry, mapping);
      entry.mappedAt = entry.mappedAt || new Date();
      await entry.save(session ? { session } : undefined);

      if (req.body.convert) {
        return convertEmailEntryToBillingRecords(entry, {
          body: req.body || {},
          actorId: req.user?.id,
          session,
        });
      }

      return { entry };
    });

    res.json({
      ok: true,
      data: result.entry,
      ...(result.activity ? { activity: result.activity } : {}),
      ...(result.timeEntry ? { timeEntry: result.timeEntry } : {}),
      ...(result.billable ? { billable: result.billable } : {}),
    });
  } catch (err) {
    res.status(err.statusCode || 400).json({ ok: false, message: err.message });
  }
};

// ---------- GPT narrative (generate / regenerate) ----------
export const generateNarrative = async (req, res) => {
  try {
    const entry = await EmailEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ ok: false, message: 'Not found' });
    if (req.user?.role !== 'admin' && String(entry.userId) !== String(req.user?.id)) {
      return res.status(403).json({ ok: false, message: 'You can only update your own email entries' });
    }

    const narrative = await generateBillableSummary({
      subject: entry.subject || '(no subject)',
      body: entry.body || '',
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
    const result = await runEmailEntryTransaction(async (session) => {
      const entry = await withSession(EmailEntry.findById(req.params.id), session);
      if (!entry) {
        const error = new Error('Not found');
        error.statusCode = 404;
        throw error;
      }
      if (!entry.clientId || !entry.caseId) {
        const error = new Error('Email entry must be mapped to a client and matter before activity creation');
        error.statusCode = 422;
        throw error;
      }
      const activity = await ensureActivityForCapture(entry, {
        actorId: req.user?.id,
        session,
      });
      entry.meta = { ...(entry.meta || {}), activityId: activity._id };
      if (entry.status === 'captured') entry.status = 'mapped';
      await entry.save(session ? { session } : undefined);
      return { entry, activity };
    });

    res.status(201).json({ ok: true, data: result.activity, entry: result.entry });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, message: err.message });
  }
};

// ---------- TimeEntry + Billable conversion ----------
export const createTimeEntryFromEmail = async (req, res) => {
  try {
    const result = await runEmailEntryTransaction(async (session) => {
      const entry = await withSession(EmailEntry.findById(req.params.id), session);
      if (!entry) {
        const error = new Error('Not found');
        error.statusCode = 404;
        throw error;
      }
      if (req.user?.role !== 'admin' && String(entry.userId) !== String(req.user?.id)) {
        const error = new Error('You can only convert your own email entries');
        error.statusCode = 403;
        throw error;
      }
      return convertEmailEntryToBillingRecords(entry, {
        body: req.body || {},
        actorId: req.user?.id,
        session,
      });
    });

    res.status(201).json({
      ok: true,
      data: result.timeEntry,
      entry: result.entry,
      activity: result.activity,
      billable: result.billable,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, message: err.message });
  }
};

// ---------- Zoho CRM sync ----------
export const syncEmailEntryToZoho = async (req, res) => {
  try {
    const entry = await EmailEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ ok: false, message: 'Not found' });
    if (req.user?.role !== 'admin' && String(entry.userId) !== String(req.user?.id)) {
      return res.status(403).json({ ok: false, message: 'You can only sync your own email entries' });
    }

    const client = await Client.findById(entry.clientId);
    const matter = await Case.findById(entry.caseId);
    if (!client || !matter) {
      return res.status(400).json({ ok: false, message: 'Email entry must be mapped to a client and matter before Zoho sync' });
    }

    const zohoUserId = req.user?.id || entry.userId;
    const zohoClient = await ensureClientInZoho(zohoUserId, client);
    const zohoMatter = await ensureCaseInZoho(zohoUserId, matter, client, zohoClient.recordId);

    entry.meta = {
      ...(entry.meta || {}),
      zohoSynced: true,
      zohoClientRecordId: zohoClient.recordId,
      zohoMatterRecordId: zohoMatter.recordId,
      zohoSyncedAt: new Date(),
    };
    await entry.save();

    res.json({
      ok: true,
      data: {
        clientRecordId: zohoClient.recordId,
        matterRecordId: zohoMatter.recordId,
      },
    });
  } catch (err) {
    console.error('[Zoho sync]', err);
    res.status(500).json({ ok: false, message: err.message });
  }
};

function validateBulkEntry(payload, index) {
  const errors = [];
  const source = normalizeSource(payload.source);
  if (!payload.subject) errors.push(`entries[${index}].subject is required`);
  if (source !== 'research' && !payload.recipient) errors.push(`entries[${index}].recipient is required`);
  if (getDurationMinutes(payload) <= 0) errors.push(`entries[${index}].duration is required`);
  if (!payload.sourceRef) errors.push(`entries[${index}].sourceRef is required for idempotent bulk ingest`);
  if (payload.meta !== undefined && (payload.meta === null || typeof payload.meta !== 'object' || Array.isArray(payload.meta))) {
    errors.push(`entries[${index}].meta must be an object`);
  }
  if (payload.autoConvert && (!payload.clientId || !payload.caseId)) {
    errors.push(`entries[${index}].autoConvert requires clientId and caseId`);
  }
  return errors;
}

// ---------- optional: bulk ingest from extension ----------
export const bulkIngest = async (req, res) => {
  try {
    const { entries = [] } = req.body || {};
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ ok: false, message: 'entries[] is required' });
    }
    if (entries.length > BULK_LIMIT) {
      return res.status(400).json({ ok: false, message: `entries[] cannot exceed ${BULK_LIMIT}` });
    }

    const results = [];
    for (let index = 0; index < entries.length; index += 1) {
      const payload = entries[index] || {};
      const validationErrors = validateBulkEntry(payload, index);
      if (validationErrors.length) {
        results.push({ ok: false, index, errors: validationErrors });
        continue;
      }

      try {
        const result = await runEmailEntryTransaction(async (session) => {
          const capture = await upsertEmailEntryFromPayload(req, payload, { session });
          if (payload.autoConvert) {
            const converted = await convertEmailEntryToBillingRecords(capture.entry, {
              body: payload,
              actorId: req.user?.id,
              session,
            });
            return { ...capture, ...converted };
          }
          return capture;
        });
        results.push({
          ok: true,
          index,
          id: result.entry._id,
          status: result.entry.status,
          idempotent: !!result.idempotent,
          activityId: result.activity?._id,
          timeEntryId: result.timeEntry?._id,
          billableId: result.billable?._id,
        });
      } catch (err) {
        results.push({ ok: false, index, error: err.message });
      }
    }

    res.status(207).json({
      ok: true,
      results,
      summary: {
        total: results.length,
        succeeded: results.filter((row) => row.ok).length,
        failed: results.filter((row) => !row.ok).length,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};
