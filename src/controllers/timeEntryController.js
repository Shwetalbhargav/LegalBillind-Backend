// src/controllers/timeEntryController.js
import mongoose from 'mongoose';
import { TimeEntry } from '../models/TimeEntry.js';
import { Activity } from '../models/Activity.js';
import { RateCard } from '../models/RateCard.js';

/** Resolve an hourly rate at a timestamp using RateCard precedence */
async function resolveRate({ userId, caseId, activityCode, at }) {
  const ts = at ? new Date(at) : new Date();
  const windowMatch = {
    effectiveFrom: { $lte: ts },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: ts } }],
  };
  const combos = [
    { userId, caseId, activityCode },
    { userId, caseId },
    { userId, activityCode },
    { userId },
  ];
  for (const combo of combos) {
    const q = { ...windowMatch };
    if (userId) q.userId = new mongoose.Types.ObjectId(userId);
    if (combo.caseId) q.caseId = new mongoose.Types.ObjectId(combo.caseId);
    if (combo.activityCode) q.activityCode = combo.activityCode;
    const hit = await RateCard.findOne(q).sort({ effectiveFrom: -1 });
    if (hit) return hit.ratePerHour;
  }
  return null;
}

/** Compute amount: prefer provided amount, else rate * (billableMinutes/60) */
function computeAmount({ amount, rateApplied, billableMinutes }) {
  if (amount != null) return Number(amount);
  const rate = Number(rateApplied || 0);
  const hours = Number(billableMinutes || 0) / 60;
  return Number((rate * hours).toFixed(2));
}

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

    let finalActivityCode = activityCode;
    if (!finalActivityCode && activityId) {
      const act = await Activity.findById(activityId);
      finalActivityCode = act?.activityCode || null;
    }

    let finalRate = rateApplied;
    if (finalRate == null) {
      finalRate = await resolveRate({ userId, caseId, activityCode: finalActivityCode, at: date });
    }

    const entry = await TimeEntry.create({
      caseId, clientId, userId,
      activityId: activityId || undefined,
      activityCode: finalActivityCode || undefined,
      narrative,
      billableMinutes,
      nonbillableMinutes,
      rateApplied: finalRate || undefined,
      amount: computeAmount({ amount, rateApplied: finalRate, billableMinutes }),
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
  try {
    const { activityId } = req.params;
    const act = await Activity.findById(activityId);
    if (!act) return res.status(404).json({ error: 'Activity not found' });

    const rate = await resolveRate({
      userId: act.userId,
      caseId: act.caseId,
      activityCode: act.activityCode,
      at: act.endedAt || act.startedAt || new Date(),
    });

    const billableMinutes = act.durationMinutes ?? 0;
    const entry = await TimeEntry.create({
      caseId: act.caseId,
      clientId: act.clientId,
      userId: act.userId,
      activityId: act._id,
      activityCode: act.activityCode,
      narrative: act.narrative || act.activityType,
      billableMinutes,
      nonbillableMinutes: 0,
      rateApplied: rate || undefined,
      amount: computeAmount({ rateApplied: rate, billableMinutes }),
      date: act.endedAt || act.startedAt || new Date(),
      status: 'draft',
    });

    res.status(201).json(entry);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create entry from activity' });
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
    if (userId) filter.userId = userId;
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
    if (!['draft', 'submitted'].includes(entry.status)) {
      return res.status(400).json({ error: 'Entry cannot be edited in its current status' });
    }

    const patch = { ...req.body };
    // If billableMinutes, rateApplied, or amount change, recompute amount unless explicitly provided
    if ((patch.billableMinutes != null || patch.rateApplied != null) && patch.amount == null) {
      const rate = patch.rateApplied != null ? patch.rateApplied : entry.rateApplied;
      const minutes = patch.billableMinutes != null ? patch.billableMinutes : entry.billableMinutes;
      patch.amount = computeAmount({ rateApplied: rate, billableMinutes: minutes });
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
async function transition(id, fromStatuses, toStatus) {
  const entry = await TimeEntry.findById(id);
  if (!entry) return { error: 'Time entry not found' };
  if (!fromStatuses.includes(entry.status)) return { error: `Entry must be in ${fromStatuses.join('/')} to ${toStatus}` };
  entry.status = toStatus;
  await entry.save();
  return { entry };
}

// POST /api/time-entries/:id/submit
export const submitTimeEntry = async (req, res) => {
  try {
    const result = await transition(req.params.id, ['draft'], 'submitted');
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result.entry);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to submit time entry' });
  }
};

// POST /api/time-entries/:id/approve
export const approveTimeEntry = async (req, res) => {
  try {
    const result = await transition(req.params.id, ['submitted'], 'approved');
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result.entry);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to approve time entry' });
  }
};

// POST /api/time-entries/:id/reject
export const rejectTimeEntry = async (req, res) => {
  try {
    const result = await transition(req.params.id, ['submitted', 'approved'], 'rejected');
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result.entry);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to reject time entry' });
  }
};
