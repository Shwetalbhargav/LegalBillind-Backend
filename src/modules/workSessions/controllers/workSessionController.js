import mongoose from 'mongoose';
import { WorkSession } from '../models/WorkSession.js';
import { Activity } from '../../activities/models/Activity.js';
import { Case } from '../../cases/models/Case.js';
import { CaseAssignment } from '../../cases/models/CaseAssignment.js';
import { TimeEntry } from '../../timeEntries/models/TimeEntry.js';
import { computeRatedAmount, resolveBillingRate } from '../../rates/services/rateResolver.js';

const DEFAULT_MAX_WORK_SESSION_MINUTES = 180;

const idString = (value) => {
  if (value === undefined || value === null) return '';
  return String(value._id || value);
};

const canAccessSession = (session, req) =>
  req.user?.role === 'admin' || idString(session?.userId) === req.user?.id;

const assertSessionAccess = (session, req, res) => {
  if (canAccessSession(session, req)) return true;
  res.status(403).json({ ok: false, message: 'You can only access your own work sessions' });
  return false;
};

const caseHasAssignedUser = (caseDoc, userId) => {
  const assignedUsers = Array.isArray(caseDoc?.assignedUsers) ? caseDoc.assignedUsers : [];
  if (assignedUsers.some((assignedUserId) => idString(assignedUserId) === String(userId))) return true;
  return ['leadPartnerId', 'managingLawyerId', 'primaryLawyerId']
    .some((field) => idString(caseDoc?.[field]) === String(userId));
};

const calculateTiming = (sessionDoc, endedAt = new Date()) => {
  const end = endedAt instanceof Date ? endedAt : new Date(endedAt);
  let pausedMs = Number(sessionDoc.pausedMs || 0);
  if (sessionDoc.status === 'paused' && sessionDoc.pausedAt) {
    pausedMs += Math.max(end.getTime() - new Date(sessionDoc.pausedAt).getTime(), 0);
  }
  const elapsedMs = Math.max(end.getTime() - new Date(sessionDoc.startedAt).getTime() - pausedMs, 0);
  const durationMinutes = Math.max(1, Math.round(elapsedMs / 60000));
  return { end, pausedMs, durationMinutes };
};

const buildAuditEntry = ({ action, actorId, changes }) => ({
  action,
  actorId,
  at: new Date(),
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

const normalizeWebMeter = (body = {}) => ({
  mode: 'manual_web_activity',
  captureLevel: body.meterCaptureLevel || 'active_window',
  idleAfterSeconds: Number(body.idleAfterSeconds || 300),
  maxSessionMinutes: Number(body.maxSessionMinutes || DEFAULT_MAX_WORK_SESSION_MINUTES),
  privacyNote: 'Tracks timer, pause/resume, heartbeat count, and optional active page title/URL only.',
  lastActiveAt: new Date(),
  inactiveSeconds: 0,
  activitySignals: ['started'],
});

const summarizeWebMeter = (workSession) => ({
  mode: workSession.webMeter?.mode || 'manual_web_activity',
  captureLevel: workSession.webMeter?.captureLevel || 'active_window',
  heartbeatCount: Number(workSession.heartbeatCount || 0),
  inactiveSeconds: Number(workSession.webMeter?.inactiveSeconds || 0),
  lastUrl: workSession.lastUrl,
  lastTitle: workSession.lastTitle,
  privacyNote: workSession.webMeter?.privacyNote || 'Tracks timer, pause/resume, heartbeat count, and optional active page title/URL only.',
});

async function createTimeEntryForActivity(activity, req, session) {
  const billableMinutes = activity.billable === false ? 0 : activity.roundedDurationMinutes;
  const nonbillableMinutes = activity.billable === false ? activity.roundedDurationMinutes : 0;
  const resolved = await resolveBillingRate({
    userId: activity.userId,
    caseId: activity.caseId,
    activityCode: activity.activityCode,
    at: activity.endedAt || activity.startedAt || new Date(),
    session,
  });

  const [entry] = await TimeEntry.create([{
    caseId: activity.caseId,
    clientId: activity.clientId,
    userId: activity.userId,
    activityId: activity._id,
    activityCode: activity.activityCode,
    narrative: activity.narrative || activity.activityType,
    billableMinutes,
    nonbillableMinutes,
    rateApplied: resolved.ratePerHour == null ? undefined : Number(resolved.ratePerHour),
    amount: computeRatedAmount({ ratePerHour: resolved.ratePerHour, billableMinutes }),
    date: activity.endedAt || activity.startedAt || new Date(),
    status: req.body?.submitTimeEntry ? 'submitted' : 'draft',
    ...(req.body?.submitTimeEntry ? {
      submittedAt: new Date(),
      submittedBy: req.user.id,
    } : {}),
  }], { session });

  await Activity.updateOne(
    { _id: activity._id },
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
          changes: { convertedTimeEntryId: entry._id },
        }),
      },
    },
    { session }
  );

  return entry;
}

export const WorkSessionController = {
  async start(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ ok: false, message: 'Not authenticated' });

      const existing = await WorkSession.findOne({ userId, status: { $in: ['running', 'paused'] } });
      if (existing) {
        return res.status(409).json({ ok: false, message: 'A work session is already running', data: existing });
      }

      const caseDoc = await Case.findById(req.body.caseId);
      if (!caseDoc) return res.status(400).json({ ok: false, message: 'caseId does not reference an existing case' });
      if (String(caseDoc.clientId) !== String(req.body.clientId)) {
        return res.status(400).json({ ok: false, message: 'clientId must match the selected matter client' });
      }
      if (req.user?.role !== 'admin' && !caseHasAssignedUser(caseDoc, userId)) {
        const assignment = await CaseAssignment.findOne({ caseId: req.body.caseId, userId, status: 'active' });
        if (!assignment) {
          return res.status(403).json({ ok: false, message: 'You can only start work on assigned matters' });
        }
      }

      const doc = await WorkSession.create({
        userId,
        clientId: req.body.clientId,
        caseId: req.body.caseId,
        activityType: req.body.activityType,
        activityCode: req.body.activityCode,
        workTool: req.body.workTool,
        narrative: req.body.narrative,
        billable: req.body.billable !== undefined ? req.body.billable : true,
        timezone: req.body.timezone,
        calendarEvent: normalizeCalendarEvent(req.body.calendarEvent, req.body.activityType),
        webMeter: normalizeWebMeter(req.body),
        status: 'running',
        startedAt: new Date(),
        lastHeartbeatAt: new Date(),
        createdBy: userId,
      });

      res.status(201).json({ ok: true, data: doc });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({ ok: false, message: 'A work session is already running' });
      }
      res.status(500).json({ ok: false, message: err.message });
    }
  },

  async current(req, res) {
    try {
      const userId = req.user?.id;
      const session = await WorkSession.findOne({ userId, status: { $in: ['running', 'paused'] } })
        .populate('clientId', 'displayName name')
        .populate('caseId', 'title name');
      res.json({ ok: true, data: session });
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  },

  async list(req, res) {
    try {
      const q = {};
      if (req.user?.role === 'admin') {
        if (req.query.userId) q.userId = req.query.userId;
      } else {
        q.userId = req.user?.id;
      }
      if (req.query.status) q.status = req.query.status;
      if (req.query.clientId) q.clientId = req.query.clientId;
      if (req.query.caseId) q.caseId = req.query.caseId;

      const rows = await WorkSession.find(q)
        .populate('clientId', 'displayName name')
        .populate('caseId', 'title name')
        .populate('activityId', 'status conversionStatus durationMinutes')
        .sort({ createdAt: -1 })
        .limit(100);

      res.json({ ok: true, data: rows });
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  },

  async heartbeat(req, res) {
    try {
      const session = await WorkSession.findById(req.params.id);
      if (!session) return res.status(404).json({ ok: false, message: 'Work session not found' });
      if (!assertSessionAccess(session, req, res)) return;
      if (!['running', 'paused'].includes(session.status)) {
        return res.status(409).json({ ok: false, message: `Cannot heartbeat a ${session.status} session` });
      }

      session.lastHeartbeatAt = req.body?.at ? new Date(req.body.at) : new Date();
      if (req.body?.url) session.lastUrl = req.body.url;
      if (req.body?.title) session.lastTitle = req.body.title;
      session.webMeter = {
        ...(session.webMeter?.toObject?.() || session.webMeter || {}),
        lastActiveAt: req.body?.active === false ? session.webMeter?.lastActiveAt : new Date(),
        inactiveSeconds: Number(req.body?.inactiveSeconds || 0),
        activitySignals: [
          ...new Set([
            ...((session.webMeter?.activitySignals || []).map((item) => String(item))),
            ...(req.body?.activitySignal ? [String(req.body.activitySignal)] : []),
          ]),
        ].slice(-20),
      };
      session.heartbeatCount = Number(session.heartbeatCount || 0) + 1;
      await session.save();

      res.json({ ok: true, data: session });
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  },

  async pause(req, res) {
    try {
      const session = await WorkSession.findById(req.params.id);
      if (!session) return res.status(404).json({ ok: false, message: 'Work session not found' });
      if (!assertSessionAccess(session, req, res)) return;
      if (session.status !== 'running') {
        return res.status(409).json({ ok: false, message: 'Only running sessions can be paused' });
      }
      session.status = 'paused';
      session.pausedAt = new Date();
      await session.save();
      res.json({ ok: true, data: session });
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  },

  async resume(req, res) {
    try {
      const session = await WorkSession.findById(req.params.id);
      if (!session) return res.status(404).json({ ok: false, message: 'Work session not found' });
      if (!assertSessionAccess(session, req, res)) return;
      if (session.status !== 'paused') {
        return res.status(409).json({ ok: false, message: 'Only paused sessions can be resumed' });
      }
      const now = new Date();
      session.pausedMs = Number(session.pausedMs || 0) + Math.max(now.getTime() - new Date(session.pausedAt).getTime(), 0);
      session.status = 'running';
      session.pausedAt = undefined;
      session.resumedAt = now;
      await session.save();
      res.json({ ok: true, data: session });
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  },

  async stop(req, res) {
    let mongoSession;
    try {
      const workSession = await WorkSession.findById(req.params.id);
      if (!workSession) return res.status(404).json({ ok: false, message: 'Work session not found' });
      if (!assertSessionAccess(workSession, req, res)) return;
      if (!['running', 'paused'].includes(workSession.status)) {
        return res.status(409).json({ ok: false, message: `Cannot stop a ${workSession.status} session` });
      }

      const timing = calculateTiming(workSession, req.body?.endedAt ? new Date(req.body.endedAt) : new Date());
      const maxSessionMinutes = Number(workSession.webMeter?.maxSessionMinutes || DEFAULT_MAX_WORK_SESSION_MINUTES);
      if (timing.durationMinutes > maxSessionMinutes) {
        return res.status(400).json({
          ok: false,
          message: `Web activity meter sessions cannot exceed ${maxSessionMinutes} minutes. Stop and create a new entry for additional work.`,
        });
      }
      mongoSession = await mongoose.startSession();
      let activity;
      let timeEntry = null;

      await mongoSession.withTransaction(async () => {
        const [createdActivity] = await Activity.create([{
          userId: workSession.userId,
          clientId: workSession.clientId,
          caseId: workSession.caseId,
          activityType: workSession.activityType,
          activityCode: workSession.activityCode,
          workTool: workSession.workTool,
          narrative: req.body?.finalNarrative || workSession.narrative || workSession.activityType,
          billable: workSession.billable,
          timezone: workSession.timezone,
          webMeter: summarizeWebMeter(workSession),
          calendarEvent: workSession.calendarEvent,
          startedAt: workSession.startedAt,
          endedAt: timing.end,
          durationMinutes: timing.durationMinutes,
          roundedDurationMinutes: timing.durationMinutes,
          workDate: workSession.startedAt,
          roundingPolicy: 'exact',
          source: 'meter',
          sourceRef: `work-session:${workSession._id}`,
          status: 'captured',
          conversionStatus: 'unconverted',
          createdBy: req.user.id,
          auditTrail: [buildAuditEntry({
            action: 'created',
            actorId: req.user.id,
            changes: { workSessionId: workSession._id },
          })],
        }], { session: mongoSession });
        activity = createdActivity;

        if (req.body?.createTimeEntry) {
          timeEntry = await createTimeEntryForActivity(activity, req, mongoSession);
        }

        workSession.status = 'stopped';
        workSession.endedAt = timing.end;
        workSession.pausedMs = timing.pausedMs;
        workSession.durationMinutes = timing.durationMinutes;
        workSession.activityId = activity._id;
        workSession.stoppedBy = req.user.id;
        await workSession.save({ session: mongoSession });
      });

      res.json({ ok: true, data: workSession, activity, timeEntry });
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    } finally {
      if (mongoSession) await mongoSession.endSession();
    }
  },

  async discard(req, res) {
    try {
      const session = await WorkSession.findById(req.params.id);
      if (!session) return res.status(404).json({ ok: false, message: 'Work session not found' });
      if (!assertSessionAccess(session, req, res)) return;
      if (!['running', 'paused'].includes(session.status)) {
        return res.status(409).json({ ok: false, message: `Cannot discard a ${session.status} session` });
      }
      session.status = 'discarded';
      session.endedAt = new Date();
      session.discardedBy = req.user.id;
      session.discardReason = req.body?.reason;
      await session.save();
      res.json({ ok: true, data: session });
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  },
};
