// src/controllers/timeEntryController.js
import mongoose from 'mongoose';
import { TimeEntry } from '../models/TimeEntry.js';
import { Activity } from '../../activities/models/Activity.js';
import { computeRatedAmount, resolveBillingRate } from '../../rates/services/rateResolver.js';

const withSession = (query, session) =>
  session && query && typeof query.session === 'function' ? query.session(session) : query;

const idString = (value) => {
  if (value === undefined || value === null) return '';
  return String(value._id || value);
};

const buildAuditEntry = ({ action, actorId, changes }) => ({
  action,
  actorId,
  at: new Date(),
  ...(changes ? { changes } : {}),
});

const isReviewerRole = (role) => ['admin', 'partner'].includes(String(role || '').toLowerCase());

const canOwnTimeEntry = (entry, req) =>
  req.user?.role === 'admin' || idString(entry?.userId) === req.user?.id;

const assertOwnTimeEntry = (entry, req, res) => {
  if (canOwnTimeEntry(entry, req)) return true;
  res.status(403).json({ error: 'You can only change your own time entries' });
  return false;
};

const assertRequestedTimeUser = (requestedUserId, req, res) => {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Not authenticated' });
    return false;
  }
  if (req.user?.role === 'admin') return true;
  if (String(requestedUserId) === req.user.id) return true;
  res.status(403).json({ error: 'Only admins can create time for another user' });
  return false;
};

const validateSubmittableEntry = (entry) => {
  if (!String(entry?.narrative || '').trim()) {
    return 'Narrative is required before submit';
  }
  const totalMinutes = Number(entry?.billableMinutes || 0) + Number(entry?.nonbillableMinutes || 0);
  if (totalMinutes <= 0) {
    return 'Time entry must have billable or nonbillable minutes';
  }
  if (Number(entry?.billableMinutes || 0) > 0 && !Number(entry?.rateApplied || 0)) {
    return 'No hourly rate is available. Add a manual rate or create a matching rate card before submit';
  }
  return null;
};

/**
 * POST /api/time-entries
 * Body: { caseId, clientId, userId, activityId?, activityCode?, narrative, billableMinutes, nonbillableMinutes, date? }
 * Auto-resolves rateApplied (if not provided) via RateCard and computes amount.
 */
export const createTimeEntry = async (req, res) => {
  try {
    const {
      caseId, clientId, userId,
      activityId, activityCode, narrative,
      billableMinutes = 0, nonbillableMinutes = 0,
      rateApplied, amount, date
    } = req.body;

    if (!caseId || !clientId || !userId || !narrative) {
      return res.status(400).json({ error: 'caseId, clientId, userId, narrative are required' });
    }
    if (!assertRequestedTimeUser(userId, req, res)) return;

    let finalActivityCode = activityCode;
    if (!finalActivityCode && activityId) {
      const act = await Activity.findById(activityId);
      finalActivityCode = act?.activityCode || null;
    }

    let finalRate = rateApplied;
    if (finalRate == null) {
      const resolved = await resolveBillingRate({
        userId,
        caseId,
        activityCode: finalActivityCode,
        at: date,
      });
      finalRate = resolved.ratePerHour;
    }

    const entry = await TimeEntry.create({
      caseId, clientId, userId,
      activityId: activityId || undefined,
      activityCode: finalActivityCode || undefined,
      narrative,
      billableMinutes,
      nonbillableMinutes,
      rateApplied: finalRate == null ? undefined : Number(finalRate),
      amount: computeRatedAmount({ amount, ratePerHour: finalRate, billableMinutes }),
      date: date ? new Date(date) : new Date(),
      status: 'draft',
    });

    res.status(201).json(entry);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create time entry' });
  }
};

/**
 * POST /api/time-entries/from-activity/:activityId
 * Creates a TimeEntry from an Activity (uses activity.durationMinutes as billableMinutes if present).
 */
export const createFromActivity = async (req, res) => {
  let session;
  try {
    const { activityId } = req.params;
    session = await mongoose.startSession();
    let entry;

    await session.withTransaction(async () => {
      const act = await withSession(Activity.findById(activityId), session);
      if (!act) {
        const error = new Error('Activity not found');
        error.statusCode = 404;
        throw error;
      }

      if (req.user?.role !== 'admin' && idString(act.userId) !== req.user?.id) {
        const error = new Error('You can only convert your own activities');
        error.statusCode = 403;
        throw error;
      }

      if (act.conversionStatus === 'converted' || act.convertedTimeEntryId) {
        const error = new Error('Activity has already been converted to a time entry');
        error.statusCode = 409;
        throw error;
      }

      if (['ignored', 'locked', 'voided'].includes(act.status)) {
        const error = new Error(`Activity cannot be converted while ${act.status}`);
        error.statusCode = 409;
        throw error;
      }

      const existing = await withSession(TimeEntry.findOne({ activityId: act._id }), session);
      if (existing) {
        const error = new Error('Activity has already been converted to a time entry');
        error.statusCode = 409;
        throw error;
      }

      const resolvedRate = await resolveBillingRate({
        userId: act.userId,
        caseId: act.caseId,
        activityCode: act.activityCode,
        at: act.endedAt || act.startedAt || new Date(),
        session,
      });
      const rate = resolvedRate.ratePerHour;

      const activityMinutes = act.roundedDurationMinutes ?? act.durationMinutes ?? 0;
      const billableMinutes = act.billable === false ? 0 : activityMinutes;
      const nonbillableMinutes = act.billable === false ? activityMinutes : 0;
      const [created] = await TimeEntry.create([{
        caseId: act.caseId,
        clientId: act.clientId,
        userId: act.userId,
        activityId: act._id,
        activityCode: act.activityCode,
        narrative: act.narrative || act.activityType,
        billableMinutes,
        nonbillableMinutes,
        rateApplied: rate == null ? undefined : Number(rate),
        amount: computeRatedAmount({ ratePerHour: rate, billableMinutes }),
        date: act.endedAt || act.startedAt || new Date(),
        status: 'draft',
      }], { session });

      entry = created;

      await Activity.updateOne(
        { _id: act._id },
        {
          $set: {
            conversionStatus: 'converted',
            status: 'converted',
            convertedTimeEntryId: entry._id,
            convertedAt: new Date(),
            updatedBy: req.user.id,
          },
          $push: {
            auditTrail: buildAuditEntry({
              action: 'converted',
              actorId: req.user.id,
              changes: {
                convertedTimeEntryId: entry._id,
                status: { from: act.status, to: 'converted' },
              },
            }),
          },
        },
        { session }
      );
    });

    res.status(201).json(entry);
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ error: 'Activity has already been converted to a time entry' });
    }

    console.error(e);
    res.status(e.statusCode || 500).json({ error: e.statusCode ? e.message : 'Failed to create entry from activity' });
  } finally {
    if (session) await session.endSession();
  }
};

/**
 * GET /api/time-entries
 * Filters: userId, clientId, caseId, status, from, to, q (narrative search)
 */
export const listTimeEntries = async (req, res) => {
  try {
    const { userId, clientId, caseId, status, from, to, q } = req.query;
    const filter = {};
    if (req.user?.role === 'admin' || req.user?.role === 'partner') {
      if (userId) filter.userId = userId;
    } else {
      if (userId && userId !== req.user?.id) {
        return res.status(403).json({ error: 'You can only list your own time entries' });
      }
      filter.userId = req.user?.id;
    }
    if (clientId) filter.clientId = clientId;
    if (caseId) filter.caseId = caseId;
    if (status) filter.status = status;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    if (q) filter.narrative = { $regex: q, $options: 'i' };

    const rows = await TimeEntry.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list time entries' });
  }
};

/**
 * PATCH /api/time-entries/:id
 * Only editable in statuses: draft, submitted
 */
export const updateTimeEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await TimeEntry.findById(id);
    if (!entry) return res.status(404).json({ error: 'Time entry not found' });
    if (!assertOwnTimeEntry(entry, req, res)) return;
    if (!['draft', 'submitted', 'rejected'].includes(entry.status)) {
      return res.status(400).json({ error: 'Entry cannot be edited in its current status' });
    }

    const patch = { ...req.body };
    const touchesFrozenRate = patch.rateApplied != null || patch.amount != null;
    if (touchesFrozenRate && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can change a frozen billing rate or amount' });
    }
    if (entry.status === 'rejected') {
      patch.status = 'draft';
      patch.rejectionReason = undefined;
      patch.reviewedAt = undefined;
      patch.reviewedBy = undefined;
    }
    // If billableMinutes, rateApplied, or amount change, recompute amount unless explicitly provided
    if ((patch.billableMinutes != null || patch.rateApplied != null) && patch.amount == null) {
      const rate = patch.rateApplied != null ? patch.rateApplied : entry.rateApplied;
      const minutes = patch.billableMinutes != null ? patch.billableMinutes : entry.billableMinutes;
      patch.amount = computeRatedAmount({ ratePerHour: rate, billableMinutes: minutes });
    }

    const updated = await TimeEntry.findByIdAndUpdate(id, patch, { new: true });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update time entry' });
  }
};

/**
 * Workflow transitions
 */
async function transition(id, fromStatuses, toStatus, req, { reason } = {}) {
  const entry = await TimeEntry.findById(id);
  if (!entry) return { error: 'Time entry not found' };
  if (!fromStatuses.includes(entry.status)) return { error: `Entry must be in ${fromStatuses.join('/')} to ${toStatus}` };
  if (toStatus === 'submitted') {
    if (!canOwnTimeEntry(entry, req)) {
      return { error: 'You can only change your own time entries', statusCode: 403 };
    }
    const validationError = validateSubmittableEntry(entry);
    if (validationError) return { error: validationError, statusCode: 400 };
    entry.submittedAt = new Date();
    entry.submittedBy = req.user.id;
  }
  if (['approved', 'rejected'].includes(toStatus)) {
    if (!isReviewerRole(req.user?.role)) {
      return { error: 'Only reviewers can approve or reject time entries', statusCode: 403 };
    }
    if (idString(entry.userId) === req.user?.id) {
      return { error: 'Reviewers cannot approve or reject their own time entries', statusCode: 403 };
    }
    entry.reviewedAt = new Date();
    entry.reviewedBy = req.user.id;
  }
  if (toStatus === 'approved') {
    entry.rejectionReason = undefined;
  }
  if (toStatus === 'rejected') {
    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason) return { error: 'Rejection reason is required', statusCode: 400 };
    if (trimmedReason.length > 500) return { error: 'Rejection reason must be at most 500 characters', statusCode: 400 };
    entry.rejectionReason = trimmedReason;
  }
  entry.status = toStatus;
  await entry.save();
  return { entry };
}

// POST /api/time-entries/:id/submit
export const submitTimeEntry = async (req, res) => {
  try {
    const result = await transition(req.params.id, ['draft'], 'submitted', req);
    if (result.error) return res.status(result.statusCode || 400).json({ error: result.error });
    res.json(result.entry);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to submit time entry' });
  }
};

// POST /api/time-entries/:id/approve
export const approveTimeEntry = async (req, res) => {
  try {
    const result = await transition(req.params.id, ['submitted'], 'approved', req);
    if (result.error) return res.status(result.statusCode || 400).json({ error: result.error });
    res.json(result.entry);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to approve time entry' });
  }
};

// POST /api/time-entries/:id/reject
export const rejectTimeEntry = async (req, res) => {
  try {
    const result = await transition(req.params.id, ['submitted'], 'rejected', req, {
      reason: req.body?.reason,
    });
    if (result.error) return res.status(result.statusCode || 400).json({ error: result.error });
    res.json(result.entry);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to reject time entry' });
  }
};
