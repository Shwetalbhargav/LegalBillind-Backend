// src/controllers/activityController.js
import { Activity } from '../models/Activity.js';
import { Case } from '../../cases/models/Case.js';
import { CaseAssignment } from '../../cases/models/CaseAssignment.js';
import { Client } from '../../clients/models/Client.js';
import { TimeEntry } from '../../timeEntries/models/TimeEntry.js';
import User from '../../users/models/User.js';

const MAX_ACTIVITY_DURATION_MINUTES = 180;
const LOCKED_TIME_ENTRY_STATUSES = ['approved', 'billed', 'paid'];
const EDIT_LOCKED_ACTIVITY_STATUSES = ['converted', 'locked', 'voided'];

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const idString = (value) => {
  if (value === undefined || value === null) return '';
  return String(value._id || value);
};

const validationFailed = (res, errors) =>
  res.status(400).json({
    ok: false,
    message: 'Validation failed',
    errors,
  });

const notFound = (res, message) => res.status(404).json({ ok: false, message });

const forbidden = (res, message) =>
  res.status(403).json({
    ok: false,
    message,
  });

const conflict = (res, message) =>
  res.status(409).json({
    ok: false,
    message,
  });

const buildAuditEntry = ({ action, actorId, reason, changes }) => ({
  action,
  actorId,
  at: new Date(),
  ...(reason ? { reason } : {}),
  ...(changes ? { changes } : {}),
});

const normalizeCalendarEvent = (calendarEvent, activityType) => {
  if (activityType !== 'hearing' || !calendarEvent || typeof calendarEvent !== 'object') return undefined;
  const clean = {
    title: calendarEvent.title,
    scheduledStart: calendarEvent.scheduledStart ? new Date(calendarEvent.scheduledStart) : undefined,
    scheduledEnd: calendarEvent.scheduledEnd ? new Date(calendarEvent.scheduledEnd) : undefined,
    courtName: calendarEvent.courtName,
    courtroom: calendarEvent.courtroom,
    judgeOrBench: calendarEvent.judgeOrBench,
    location: calendarEvent.location,
    videoLink: calendarEvent.videoLink,
    externalCalendarId: calendarEvent.externalCalendarId,
    notes: calendarEvent.notes,
  };
  Object.keys(clean).forEach((key) => {
    if (clean[key] === undefined || clean[key] === null || clean[key] === '') delete clean[key];
  });
  return Object.keys(clean).length ? { ...clean, attachedAt: new Date() } : undefined;
};

const populateActivity = (query) => {
  if (!query || typeof query.populate !== 'function') return query;
  return query
    .populate('userId', 'name role email')
    .populate('clientId', 'displayName name')
    .populate('caseId', 'title name status billingType');
};

const resolveActivityUserId = (req, res) => {
  const actorId = req.user?.id;
  const requestedUserId = req.body?.userId;

  if (!actorId) {
    res.status(401).json({ ok: false, message: 'Not authenticated' });
    return null;
  }

  if (requestedUserId && requestedUserId !== actorId && req.user?.role !== 'admin') {
    forbidden(res, 'Only admins can create activity for another user');
    return null;
  }

  return req.user?.role === 'admin' && requestedUserId ? requestedUserId : actorId;
};

const assertActivityAccess = (activity, req, res) => {
  if (req.user?.role === 'admin') return true;
  if (idString(activity?.userId) === req.user?.id) return true;
  forbidden(res, 'You can only access your own activities');
  return false;
};

const caseHasAssignedUser = (caseDoc, userId) => {
  const assignedUsers = Array.isArray(caseDoc?.assignedUsers) ? caseDoc.assignedUsers : [];
  if (assignedUsers.some((assignedUserId) => idString(assignedUserId) === String(userId))) {
    return true;
  }

  return ['leadPartnerId', 'managingLawyerId', 'primaryLawyerId']
    .some((field) => idString(caseDoc?.[field]) === String(userId));
};

const validateActivityReferences = async ({ caseId, clientId, userId, actorRole }) => {
  const errors = [];
  const [caseDoc, clientExists, userExists] = await Promise.all([
    Case.findById(caseId),
    Client.exists({ _id: clientId }),
    User.exists({ _id: userId }),
  ]);

  if (!caseDoc) {
    errors.push({ field: 'caseId', message: 'caseId does not reference an existing case' });
  }

  if (!clientExists) {
    errors.push({ field: 'clientId', message: 'clientId does not reference an existing client' });
  }

  if (!userExists) {
    errors.push({ field: 'userId', message: 'userId does not reference an existing user' });
  }

  if (caseDoc && String(caseDoc.clientId) !== String(clientId)) {
    errors.push({ field: 'clientId', message: 'clientId must match the activity case client' });
  }

  if (caseDoc && ['closed', 'archived'].includes(caseDoc.status) && actorRole !== 'admin') {
    errors.push({ field: 'caseId', message: 'Cannot create activity on a closed or archived case' });
  }

  if (caseDoc && userExists && !caseHasAssignedUser(caseDoc, userId)) {
    const assignment = await CaseAssignment.findOne({ caseId, userId, status: 'active' });
    if (!assignment) {
      errors.push({ field: 'userId', message: 'userId must be actively assigned to the case' });
    }
  }

  return errors;
};

const buildDate = (value) => (value ? new Date(value) : undefined);

const roundDuration = (duration, roundingPolicy = 'exact') => {
  const minutes = Number(duration || 0);
  if (roundingPolicy === 'six_minute') return Math.ceil(minutes / 6) * 6;
  if (roundingPolicy === 'fifteen_minute') return Math.ceil(minutes / 15) * 15;
  return minutes;
};

const buildTiming = (payload, existing = {}) => {
  const startedAt = hasOwn(payload, 'startedAt') ? buildDate(payload.startedAt) : existing.startedAt;
  const endedAt = hasOwn(payload, 'endedAt') ? buildDate(payload.endedAt) : existing.endedAt;
  const hasPayloadDuration = hasOwn(payload, 'durationMinutes') &&
    payload.durationMinutes !== undefined &&
    payload.durationMinutes !== null &&
    payload.durationMinutes !== '';
  let durationMinutes = hasPayloadDuration
    ? Number(payload.durationMinutes)
    : existing.durationMinutes;

  if (
    !hasPayloadDuration &&
    durationMinutes === undefined &&
    startedAt &&
    endedAt
  ) {
    durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
  }

  if (startedAt && endedAt && endedAt < startedAt) {
    return {
      errors: [{
        field: 'endedAt',
        message: 'endedAt must be greater than or equal to startedAt',
      }],
    };
  }

  const roundingPolicy = payload.roundingPolicy || existing.roundingPolicy || 'exact';

  return {
    startedAt,
    endedAt,
    durationMinutes,
    roundingPolicy,
    roundedDurationMinutes: roundDuration(durationMinutes, roundingPolicy),
    workDate: startedAt || endedAt || existing.workDate || new Date(),
  };
};

const validateDurationPolicy = ({ durationMinutes, req, durationOverrideReason }) => {
  if (Number(durationMinutes || 0) <= MAX_ACTIVITY_DURATION_MINUTES) return null;
  if (req.user?.role === 'admin' && durationOverrideReason) return null;

  return {
    field: 'durationMinutes',
    message: `durationMinutes cannot exceed ${MAX_ACTIVITY_DURATION_MINUTES} minutes without admin override reason`,
  };
};

const validateTimeRangePolicy = ({ startedAt, endedAt }) => {
  if (!startedAt || !endedAt) return null;
  const rangeMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
  if (rangeMinutes <= MAX_ACTIVITY_DURATION_MINUTES) return null;

  return {
    field: 'endedAt',
    message: `Work time range cannot exceed ${MAX_ACTIVITY_DURATION_MINUTES} minutes`,
  };
};

const assertNoOverlappingActivity = async ({ userId, startedAt, endedAt, excludeActivityId }, res) => {
  if (!startedAt || !endedAt) return true;

  const query = {
    userId,
    status: { $nin: ['ignored', 'voided'] },
    startedAt: { $lt: endedAt },
    endedAt: { $gt: startedAt },
  };
  if (excludeActivityId) query._id = { $ne: excludeActivityId };

  const overlap = await Activity.findOne(query);
  if (overlap) {
    conflict(res, 'Activity overlaps with another activity for this user');
    return false;
  }

  return true;
};

const findIdempotentActivity = ({ userId, source, sourceRef }) => {
  if (!sourceRef) return null;
  return Activity.findOne({ userId, source, sourceRef });
};

const ensureEditableActivity = async (activity, res) => {
  if (EDIT_LOCKED_ACTIVITY_STATUSES.includes(activity.status)) {
    conflict(res, `Activity cannot be edited while ${activity.status}`);
    return false;
  }

  const lockedTimeEntry = await TimeEntry.findOne({
    activityId: activity._id,
    status: { $in: LOCKED_TIME_ENTRY_STATUSES },
  });

  if (lockedTimeEntry) {
    conflict(res, 'Activity is locked by an approved, billed, or paid time entry');
    return false;
  }

  return true;
};

const pickUpdatePayload = (payload = {}) => {
  const fields = [
    'activityType',
    'startedAt',
    'endedAt',
    'durationMinutes',
    'roundingPolicy',
    'billable',
    'durationOverrideReason',
    'source',
    'workTool',
    'sourceRef',
    'narrative',
    'activityCode',
    'timezone',
    'calendarEvent',
  ];

  return fields.reduce((acc, field) => {
    if (hasOwn(payload, field)) acc[field] = payload[field];
    return acc;
  }, {});
};

const updateLifecycle = async ({ activity, req, res, status, action, reason, metadata = {} }) => {
  if (!assertActivityAccess(activity, req, res)) return null;
  if (!(await ensureEditableActivity(activity, res))) return null;

  const updated = await Activity.findByIdAndUpdate(
    activity._id,
    {
      $set: {
        status,
        updatedBy: req.user.id,
        ...metadata,
      },
      $push: {
        auditTrail: buildAuditEntry({
          action,
          actorId: req.user.id,
          reason,
          changes: { status: { from: activity.status, to: status } },
        }),
      },
    },
    { new: true, runValidators: true }
  );

  return updated;
};

const loadActivity = async (activityId) => Activity.findById(activityId);

export const ActivityController = {
  // POST /activities
  async create(req, res) {
    try {
      const {
        caseId, clientId,
        activityType, startedAt, endedAt, durationMinutes,
        source, workTool, sourceRef, narrative, activityCode, timezone, calendarEvent,
        roundingPolicy, billable, durationOverrideReason,
      } = req.body;

      const userId = resolveActivityUserId(req, res);
      if (!userId) return;

      const referenceErrors = await validateActivityReferences({
        caseId,
        clientId,
        userId,
        actorRole: req.user?.role,
      });
      if (referenceErrors.length) return validationFailed(res, referenceErrors);

      const sourceValue = source || 'extension';
      const existing = await findIdempotentActivity({ userId, source: sourceValue, sourceRef });
      if (existing) {
        return res.json({ ok: true, data: existing, idempotent: true });
      }

      const timing = buildTiming({ startedAt, endedAt, durationMinutes, roundingPolicy });
      if (timing.errors) return validationFailed(res, timing.errors);

      const rangeError = validateTimeRangePolicy({
        startedAt: timing.startedAt,
        endedAt: timing.endedAt,
      });
      if (rangeError) return validationFailed(res, [rangeError]);

      const durationError = validateDurationPolicy({
        durationMinutes: timing.durationMinutes,
        req,
        durationOverrideReason,
      });
      if (durationError) return validationFailed(res, [durationError]);

      const noOverlap = await assertNoOverlappingActivity({
        userId,
        startedAt: timing.startedAt,
        endedAt: timing.endedAt,
      }, res);
      if (!noOverlap) return;

      const doc = await Activity.create({
        caseId,
        clientId,
        userId,
        activityType,
        startedAt: timing.startedAt,
        endedAt: timing.endedAt,
        durationMinutes: timing.durationMinutes,
        roundedDurationMinutes: timing.roundedDurationMinutes,
        workDate: timing.workDate,
        roundingPolicy: timing.roundingPolicy,
        billable: billable !== undefined ? billable : true,
        durationOverrideReason,
        source: sourceValue,
        workTool,
        sourceRef,
        narrative,
        activityCode,
        timezone,
        calendarEvent: normalizeCalendarEvent(calendarEvent, activityType),
        status: 'captured',
        conversionStatus: 'unconverted',
        createdBy: req.user.id,
        auditTrail: [buildAuditEntry({ action: 'created', actorId: req.user.id })],
      });

      res.status(201).json({ ok: true, data: doc });
    } catch (err) {
      if (err?.code === 11000 && req.body?.sourceRef) {
        const userId = req.user?.role === 'admin' && req.body?.userId ? req.body.userId : req.user?.id;
        const existing = await findIdempotentActivity({
          userId,
          source: req.body?.source || 'extension',
          sourceRef: req.body.sourceRef,
        });

        if (existing) {
          return res.json({ ok: true, data: existing, idempotent: true });
        }
      }

      res.status(400).json({ ok: false, message: err.message });
    }
  },

  // GET /activities
  async list(req, res) {
    try {
      const {
        caseId, clientId, userId, activityType, status, billable, source,
        from, to, page = 1, limit = 25, sort = '-workDate'
      } = req.query;

      const q = {};
      if (caseId) q.caseId = caseId;
      if (clientId) q.clientId = clientId;
      if (activityType) q.activityType = activityType;
      if (status) q.status = status;
      if (source) q.source = source;
      if (billable === 'true') q.billable = true;
      if (billable === 'false') q.billable = false;

      if (req.user?.role === 'admin') {
        if (userId) q.userId = userId;
      } else {
        if (userId && userId !== req.user?.id) {
          return forbidden(res, 'You can only list your own activities');
        }
        q.userId = req.user?.id;
      }

      if (from || to) {
        q.workDate = {};
        if (from) q.workDate.$gte = new Date(from);
        if (to) q.workDate.$lte = new Date(to);
      }

      const pageNumber = Number(page);
      const limitNumber = Math.min(Number(limit), 100);
      const skip = (pageNumber - 1) * limitNumber;
      const [items, total] = await Promise.all([
        populateActivity(Activity.find(q)).sort(sort).skip(skip).limit(limitNumber),
        Activity.countDocuments(q)
      ]);

      res.json({
        ok: true,
        data: items,
        meta: { page: pageNumber, limit: limitNumber, total }
      });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async getById(req, res) {
    try {
      const activity = await populateActivity(Activity.findById(req.params.activityId));
      if (!activity) return notFound(res, 'Activity not found');
      if (!assertActivityAccess(activity, req, res)) return;

      res.json({ ok: true, data: activity });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async update(req, res) {
    try {
      const activity = await loadActivity(req.params.activityId);
      if (!activity) return notFound(res, 'Activity not found');
      if (!assertActivityAccess(activity, req, res)) return;
      if (!(await ensureEditableActivity(activity, res))) return;

      const payload = pickUpdatePayload(req.body);
      const timing = buildTiming(payload, activity);
      if (timing.errors) return validationFailed(res, timing.errors);

      const rangeError = validateTimeRangePolicy({
        startedAt: timing.startedAt,
        endedAt: timing.endedAt,
      });
      if (rangeError) return validationFailed(res, [rangeError]);

      const durationError = validateDurationPolicy({
        durationMinutes: timing.durationMinutes,
        req,
        durationOverrideReason: payload.durationOverrideReason || activity.durationOverrideReason,
      });
      if (durationError) return validationFailed(res, [durationError]);

      const noOverlap = await assertNoOverlappingActivity({
        userId: activity.userId,
        startedAt: timing.startedAt,
        endedAt: timing.endedAt,
        excludeActivityId: activity._id,
      }, res);
      if (!noOverlap) return;

      const update = {
        ...payload,
        startedAt: timing.startedAt,
        endedAt: timing.endedAt,
        durationMinutes: timing.durationMinutes,
        roundedDurationMinutes: timing.roundedDurationMinutes,
        workDate: timing.workDate,
        roundingPolicy: timing.roundingPolicy,
        calendarEvent: normalizeCalendarEvent(payload.calendarEvent, payload.activityType || activity.activityType),
        updatedBy: req.user.id,
      };
      if (payload.calendarEvent === undefined) delete update.calendarEvent;

      const updated = await Activity.findByIdAndUpdate(
        activity._id,
        {
          $set: update,
          $push: {
            auditTrail: buildAuditEntry({
              action: 'updated',
              actorId: req.user.id,
              changes: payload,
            }),
          },
        },
        { new: true, runValidators: true }
      );

      res.json({ ok: true, data: updated });
    } catch (err) {
      if (err?.code === 11000 && req.body?.sourceRef) {
        return conflict(res, 'Activity sourceRef already exists for this user and source');
      }

      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async review(req, res) {
    try {
      const activity = await loadActivity(req.params.activityId);
      if (!activity) return notFound(res, 'Activity not found');

      const updated = await updateLifecycle({
        activity,
        req,
        res,
        status: 'reviewed',
        action: 'reviewed',
        metadata: {
          reviewedAt: new Date(),
          reviewedBy: req.user.id,
        },
      });
      if (!updated) return;

      res.json({ ok: true, data: updated });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async ignore(req, res) {
    try {
      const activity = await loadActivity(req.params.activityId);
      if (!activity) return notFound(res, 'Activity not found');

      const updated = await updateLifecycle({
        activity,
        req,
        res,
        status: 'ignored',
        action: 'ignored',
        reason: req.body?.reason,
        metadata: {
          ignoredAt: new Date(),
          ignoredBy: req.user.id,
        },
      });
      if (!updated) return;

      res.json({ ok: true, data: updated });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async lock(req, res) {
    try {
      const activity = await loadActivity(req.params.activityId);
      if (!activity) return notFound(res, 'Activity not found');

      const updated = await updateLifecycle({
        activity,
        req,
        res,
        status: 'locked',
        action: 'locked',
        reason: req.body?.reason,
        metadata: {
          lockedAt: new Date(),
          lockedBy: req.user.id,
        },
      });
      if (!updated) return;

      res.json({ ok: true, data: updated });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async void(req, res) {
    try {
      const activity = await loadActivity(req.params.activityId);
      if (!activity) return notFound(res, 'Activity not found');

      const updated = await updateLifecycle({
        activity,
        req,
        res,
        status: 'voided',
        action: req.method === 'DELETE' ? 'deleted' : 'voided',
        reason: req.body?.reason,
        metadata: {
          voidedAt: new Date(),
          voidedBy: req.user.id,
          voidReason: req.body?.reason,
        },
      });
      if (!updated) return;

      res.json({ ok: true, data: updated });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },
};
