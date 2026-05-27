import mongoose from 'mongoose';
import { Activity } from '../../activities/models/Activity.js';
import { TimeEntry } from '../../timeEntries/models/TimeEntry.js';
import Billable from '../../billables/models/Billable.js';
import { resolveBillingRate } from '../../rates/services/rateResolver.js';

const ACTIVITY_BY_SOURCE = {
  research: {
    activityType: 'research',
    activityCode: 'RESEARCH',
    category: 'Legal research',
  },
  gmail: {
    activityType: 'email',
    activityCode: 'EMAIL',
    category: 'Email drafting/review',
  },
  extension: {
    activityType: 'email',
    activityCode: 'EMAIL',
    category: 'Email drafting/review',
  },
};

const SUBMITTED_STATUSES = ['draft', 'submitted'];

const withSession = (query, session) =>
  session && query && typeof query.session === 'function' ? query.session(session) : query;

const minutes = (value) => Math.max(Number(value || 0), 0);

function roundToIncrement(mins, increment = 6) {
  return Math.max(increment, Math.ceil(minutes(mins) / increment) * increment);
}

function getCaptureMinutes(entry) {
  if (entry.typingTimeMinutes != null) return minutes(entry.typingTimeMinutes);
  if (entry.typingTimeSeconds != null) return minutes(entry.typingTimeSeconds) / 60;
  return 0;
}

function getCaptureKind(entry) {
  return ACTIVITY_BY_SOURCE[entry.source] || ACTIVITY_BY_SOURCE.extension;
}

function getCaptureSourceRef(entry) {
  return String(entry.sourceRef || entry._id);
}

function getNarrative(entry) {
  const prefix = entry.source === 'research' ? 'Research' : 'Email';
  return entry.billableSummary || `${prefix}: ${entry.subject || '(no subject)'}`;
}

function isTransactionUnsupported(err) {
  const message = String(err?.message || '');
  return err?.code === 20 ||
    /Transaction numbers are only allowed/i.test(message) ||
    /replica set member or mongos/i.test(message);
}

export async function runEmailEntryTransaction(work) {
  let session;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err) {
    if (isTransactionUnsupported(err)) {
      return work(null);
    }
    throw err;
  } finally {
    if (session) await session.endSession();
  }
}

export async function ensureActivityForCapture(entry, { actorId, session } = {}) {
  const meta = entry.meta || {};
  if (mongoose.Types.ObjectId.isValid(String(meta.activityId || ''))) {
    const existing = await withSession(Activity.findById(meta.activityId), session);
    if (existing) return existing;
  }

  const source = entry.source || 'extension';
  const sourceRef = getCaptureSourceRef(entry);
  const existing = await withSession(
    Activity.findOne({
      userId: entry.userId,
      source,
      sourceRef,
    }),
    session
  );
  if (existing) return existing;

  const kind = getCaptureKind(entry);
  const [activity] = await Activity.create([{
    userId: entry.userId,
    clientId: entry.clientId,
    caseId: entry.caseId,
    activityType: kind.activityType,
    durationMinutes: getCaptureMinutes(entry),
    roundedDurationMinutes: roundToIncrement(getCaptureMinutes(entry)),
    workDate: entry.workDate || entry.createdAt || new Date(),
    narrative: getNarrative(entry),
    source,
    sourceRef,
    activityCode: kind.activityCode,
    status: 'captured',
    conversionStatus: 'unconverted',
    createdBy: actorId || entry.userId,
    auditTrail: [{
      action: 'created',
      actorId: actorId || entry.userId,
      at: new Date(),
      changes: { emailEntryId: entry._id },
    }],
  }], session ? { session } : undefined);

  return activity;
}

async function ensureTimeEntryForCapture(entry, { activity, body = {}, actorId, session } = {}) {
  const meta = entry.meta || {};
  if (mongoose.Types.ObjectId.isValid(String(meta.timeEntryId || ''))) {
    const existing = await withSession(TimeEntry.findById(meta.timeEntryId), session);
    if (existing) return existing;
  }

  const existing = await withSession(TimeEntry.findOne({ activityId: activity._id }), session);
  if (existing) return existing;

  const kind = getCaptureKind(entry);
  const billableMinutes = roundToIncrement(getCaptureMinutes(entry));
  const workDate = body.date ? new Date(body.date) : entry.workDate || entry.createdAt || new Date();
  let rateApplied = body.rateApplied ?? body.rate;
  if (rateApplied == null) {
    const resolved = await resolveBillingRate({
      userId: entry.userId,
      caseId: entry.caseId,
      activityCode: kind.activityCode,
      at: workDate,
      session,
    });
    rateApplied = resolved.ratePerHour;
  }
  const amount = rateApplied != null
    ? Number((Number(rateApplied) * (billableMinutes / 60)).toFixed(2))
    : undefined;
  const status = SUBMITTED_STATUSES.includes(body.status) ? body.status : 'submitted';

  const [timeEntry] = await TimeEntry.create([{
    userId: entry.userId,
    clientId: entry.clientId,
    caseId: entry.caseId,
    activityId: activity._id,
    activityCode: kind.activityCode,
    narrative: getNarrative(entry),
    billableMinutes,
    nonbillableMinutes: 0,
    rateApplied: rateApplied ?? undefined,
    amount,
    date: workDate,
    status,
    ...(status === 'submitted' ? {
      submittedAt: new Date(),
      submittedBy: actorId || entry.userId,
    } : {}),
  }], session ? { session } : undefined);

  return timeEntry;
}

async function ensureBillableForCapture(entry, { activity, timeEntry, session } = {}) {
  const meta = entry.meta || {};
  if (mongoose.Types.ObjectId.isValid(String(meta.billableId || ''))) {
    const existing = await withSession(Billable.findById(meta.billableId), session);
    if (existing) return existing;
  }

  const existing = await withSession(Billable.findOne({ activityId: activity._id }), session);
  if (existing) return existing;

  const kind = getCaptureKind(entry);
  const durationMinutes = roundToIncrement(timeEntry.billableMinutes || getCaptureMinutes(entry));
  let rate = timeEntry.rateApplied;
  if (rate == null) {
    const resolved = await resolveBillingRate({
      userId: entry.userId,
      caseId: entry.caseId,
      activityCode: kind.activityCode,
      at: timeEntry.date || entry.workDate || entry.createdAt,
      session,
    });
    rate = resolved.ratePerHour;
  }
  rate = Number(rate ?? 0);
  const amount = Number((rate * (durationMinutes / 60)).toFixed(2));

  const [billable] = await Billable.create([{
    caseId: entry.caseId,
    clientId: entry.clientId,
    userId: entry.userId,
    activityId: activity._id,
    subject: entry.subject,
    activityCode: kind.activityCode,
    category: kind.category,
    description: getNarrative(entry),
    durationMinutes,
    rate,
    amount,
    date: timeEntry.date || entry.workDate || entry.createdAt || new Date(),
    status: 'pending',
  }], session ? { session } : undefined);

  return billable;
}

export async function convertEmailEntryToBillingRecords(entry, { body = {}, actorId, session } = {}) {
  if (!entry.clientId || !entry.caseId) {
    const error = new Error('Email entry must be mapped to a client and matter before conversion');
    error.statusCode = 422;
    throw error;
  }

  const activity = await ensureActivityForCapture(entry, { actorId, session });
  const timeEntry = await ensureTimeEntryForCapture(entry, { activity, body, actorId, session });
  const billable = await ensureBillableForCapture(entry, { activity, timeEntry, session });

  await Activity.updateOne(
    { _id: activity._id },
    {
      $set: {
        status: 'converted',
        conversionStatus: 'converted',
        convertedTimeEntryId: timeEntry._id,
        convertedAt: new Date(),
        updatedBy: actorId || entry.userId,
      },
      $push: {
        auditTrail: {
          action: 'converted',
          actorId: actorId || entry.userId,
          at: new Date(),
          changes: {
            convertedTimeEntryId: timeEntry._id,
            billableId: billable._id,
          },
        },
      },
    },
    session ? { session } : undefined
  );

  entry.meta = {
    ...(entry.meta || {}),
    activityId: activity._id,
    timeEntryId: timeEntry._id,
    billableId: billable._id,
  };
  entry.status = billable.status === 'billed' ? 'billed' : 'converted';
  entry.convertedAt = entry.convertedAt || new Date();
  await entry.save(session ? { session } : undefined);

  return { activity, timeEntry, billable, entry };
}
