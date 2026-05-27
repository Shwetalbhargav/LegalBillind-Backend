import { CaseAssignment } from '../models/CaseAssignment.js';
import { Case } from '../models/Case.js';
import User from '../../users/models/User.js';

const notFound = (res, message) => res.status(404).json({ ok: false, message });

const assignmentPayload = (payload = {}, fields) =>
  fields.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) acc[field] = payload[field];
    return acc;
  }, {});

const CREATE_FIELDS = ['caseId', 'userId', 'role', 'startAt', 'endAt', 'status'];
const UPDATE_FIELDS = ['role', 'startAt', 'endAt', 'status'];

const buildOverlapQuery = ({ caseId, userId, startAt, endAt, excludeId }) => {
  const query = {
    caseId,
    userId,
    status: 'active',
  };

  if (excludeId) query._id = { $ne: excludeId };

  const start = startAt ? new Date(startAt) : new Date(0);
  const end = endAt ? new Date(endAt) : new Date('9999-12-31T23:59:59.999Z');

  query.$and = [
    {
      $or: [
        { startAt: { $exists: false } },
        { startAt: null },
        { startAt: { $lte: end } },
      ],
    },
    {
      $or: [
        { endAt: { $exists: false } },
        { endAt: null },
        { endAt: { $gte: start } },
      ],
    },
  ];

  return query;
};

const validateAssignmentReferences = async ({ caseId, userId }, res) => {
  const [caseDoc, userDoc] = await Promise.all([
    Case.findById(caseId),
    User.findById(userId),
  ]);

  if (!caseDoc) {
    notFound(res, 'Case not found');
    return false;
  }
  if (!userDoc) {
    notFound(res, 'User not found');
    return false;
  }

  return true;
};

const assertNoActiveOverlap = async ({ caseId, userId, startAt, endAt, status }, res, excludeId) => {
  if (status === 'inactive') return true;

  const existing = await CaseAssignment.findOne(buildOverlapQuery({
    caseId,
    userId,
    startAt,
    endAt,
    excludeId,
  }));

  if (existing) {
    res.status(409).json({
      ok: false,
      message: 'Active assignment already exists for this user and case',
    });
    return false;
  }

  return true;
};

const syncCaseAssignedUsers = async ({ caseId, userId, status }) => {
  if (status === 'inactive') {
    const activeCount = await CaseAssignment.countDocuments({ caseId, userId, status: 'active' });
    if (activeCount === 0) {
      await Case.updateOne({ _id: caseId }, { $pull: { assignedUsers: userId } });
    }
    return;
  }

  await Case.updateOne({ _id: caseId }, { $addToSet: { assignedUsers: userId } });
};

export const CaseAssignmentController = {
  // POST /case-assignments
  async assign(req, res) {
    try {
      const payload = assignmentPayload(req.body, CREATE_FIELDS);
      const refsValid = await validateAssignmentReferences(payload, res);
      if (!refsValid) return;

      const noOverlap = await assertNoActiveOverlap(payload, res);
      if (!noOverlap) return;

      const assignment = await CaseAssignment.create(payload);
      await syncCaseAssignedUsers({
        caseId: payload.caseId,
        userId: payload.userId,
        status: payload.status || 'active',
      });

      res.status(201).json({ ok: true, data: assignment });
    } catch (err) {
      const status = err?.code === 11000 ? 409 : 400;
      res.status(status).json({ ok: false, message: err?.code === 11000
        ? 'Active assignment already exists for this user and case'
        : err.message });
    }
  },

  // PUT /case-assignments/:id
  async update(req, res) {
    try {
      const { id } = req.params;
      const existing = await CaseAssignment.findById(id);
      if (!existing) return notFound(res, 'Assignment not found');

      const payload = assignmentPayload(req.body, UPDATE_FIELDS);
      const nextStatus = payload.status || existing.status || 'active';
      const nextStartAt = Object.prototype.hasOwnProperty.call(payload, 'startAt')
        ? payload.startAt
        : existing.startAt;
      const nextEndAt = Object.prototype.hasOwnProperty.call(payload, 'endAt')
        ? payload.endAt
        : existing.endAt;

      const noOverlap = await assertNoActiveOverlap({
        caseId: existing.caseId,
        userId: existing.userId,
        startAt: nextStartAt,
        endAt: nextEndAt,
        status: nextStatus,
      }, res, id);
      if (!noOverlap) return;

      const updated = await CaseAssignment.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
      });

      await syncCaseAssignedUsers({
        caseId: existing.caseId,
        userId: existing.userId,
        status: nextStatus,
      });

      res.json({ ok: true, data: updated });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  // DELETE /case-assignments/:id
  async remove(req, res) {
    try {
      const { id } = req.params;

      const assignment = await CaseAssignment.findById(id);
      if (!assignment) return notFound(res, 'Assignment not found');

      await CaseAssignment.deleteOne({ _id: id });

      const activeCount = await CaseAssignment.countDocuments({
        caseId: assignment.caseId,
        userId: assignment.userId,
        status: 'active',
      });

      if (activeCount === 0) {
        await Case.updateOne(
          { _id: assignment.caseId },
          { $pull: { assignedUsers: assignment.userId } }
        );
      }

      res.json({ ok: true, message: 'Assignment removed' });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  // GET /case-assignments
  async list(req, res) {
    try {
      const { caseId, userId, status } = req.query;
      const q = {};
      if (caseId) q.caseId = caseId;
      if (userId) q.userId = userId;
      if (status) q.status = status;

      const assignments = await CaseAssignment.find(q)
        .populate('caseId', 'title status')
        .populate('userId', 'name role email');

      res.json({ ok: true, data: assignments });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  // GET /case-assignments/:id
  async getById(req, res) {
    try {
      const assignment = await CaseAssignment.findById(req.params.id)
        .populate('caseId', 'title status')
        .populate('userId', 'name role email');

      if (!assignment) return notFound(res, 'Assignment not found');
      res.json({ ok: true, data: assignment });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  // GET /case-assignments/timeline/:caseId
  async staffingTimeline(req, res) {
    try {
      const { caseId } = req.params;

      const assignments = await CaseAssignment.find({ caseId })
        .populate('userId', 'name role email')
        .sort({ startAt: 1 });

      const timeline = assignments.map(a => ({
        user: a.userId,
        role: a.role,
        startAt: a.startAt,
        endAt: a.endAt
      }));

      res.json({ ok: true, data: timeline });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  }
};
