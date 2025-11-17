// src/controllers/caseAssignmentController.js
import { CaseAssignment } from '../models/CaseAssignment.js';
import { Case } from '../models/Case.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

export const CaseAssignmentController = {
  // POST /case-assignments
  async assign(req, res) {
    try {
      const { caseId, userId, roleOnCase, startAt, endAt } = req.body;

      if (!caseId || !userId || !roleOnCase) {
        return res.status(400).json({ ok: false, message: 'caseId, userId, and roleOnCase are required' });
      }

      // Ensure valid Case and User exist
      const [caseDoc, userDoc] = await Promise.all([
        Case.findById(caseId),
        User.findById(userId)
      ]);
      if (!caseDoc) return res.status(404).json({ ok: false, message: 'Case not found' });
      if (!userDoc) return res.status(404).json({ ok: false, message: 'User not found' });

      // Create assignment
      const assignment = await CaseAssignment.create({
        caseId,
        userId,
        roleOnCase,
        startAt,
        endAt
      });

      // Optionally update Case.assignedUsers list (idempotent)
      await Case.updateOne(
        { _id: caseId },
        { $addToSet: { assignedUsers: userId } }
      );

      res.status(201).json({ ok: true, data: assignment });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  // DELETE /case-assignments/:id
  async remove(req, res) {
    try {
      const { id } = req.params;
      const assignment = await CaseAssignment.findById(id);
      if (!assignment) return res.status(404).json({ ok: false, message: 'Assignment not found' });

      await CaseAssignment.deleteOne({ _id: id });

      // Optionally remove from Case.assignedUsers if no other active assignments
      const others = await CaseAssignment.countDocuments({
        caseId: assignment.caseId,
        userId: assignment.userId
      });
      if (others === 0) {
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

  // GET /case-assignments?caseId=&userId=
  async list(req, res) {
    try {
      const { caseId, userId } = req.query;
      const q = {};
      if (caseId) q.caseId = caseId;
      if (userId) q.userId = userId;

      const assignments = await CaseAssignment.find(q)
        .populate('caseId', 'title status')
        .populate('userId', 'name role email');

      res.json({ ok: true, data: assignments });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  // GET /case-assignments/timeline/:caseId
  async staffingTimeline(req, res) {
    try {
      const { caseId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(caseId))
        return res.status(400).json({ ok: false, message: 'Invalid caseId' });

      const assignments = await CaseAssignment.find({ caseId })
        .populate('userId', 'name role email')
        .sort({ startAt: 1 });

      const timeline = assignments.map(a => ({
        user: a.userId,
        roleOnCase: a.roleOnCase,
        startAt: a.startAt,
        endAt: a.endAt
      }));

      res.json({ ok: true, data: timeline });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  }
};
