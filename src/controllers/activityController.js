// src/controllers/activityController.js
import { Activity } from '../models/Activity.js';

export const ActivityController = {
  // POST /activities
  async create(req, res) {
    try {
      const {
        caseId, clientId, userId,
        activityType, startedAt, endedAt, durationMinutes,
        source, sourceRef, narrative, activityCode
      } = req.body;

      let duration = durationMinutes;
      if (!duration && startedAt && endedAt) {
        duration = Math.max(
          0,
          Math.round((new Date(endedAt) - new Date(startedAt)) / 60000)
        );
      }

      const doc = await Activity.create({
        caseId, clientId, userId,
        activityType, startedAt, endedAt, durationMinutes: duration,
        source, sourceRef, narrative, activityCode
      });

      res.status(201).json({ ok: true, data: doc });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  // GET /activities
  async list(req, res) {
    try {
      const {
        caseId, clientId, userId, activityType,
        from, to, page = 1, limit = 25, sort = '-createdAt'
      } = req.query;

      const q = {};
      if (caseId) q.caseId = caseId;
      if (clientId) q.clientId = clientId;
      if (userId) q.userId = userId;
      if (activityType) q.activityType = activityType;
      if (from || to) {
        q.createdAt = {};
        if (from) q.createdAt.$gte = new Date(from);
        if (to) q.createdAt.$lte = new Date(to);
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [items, total] = await Promise.all([
        Activity.find(q).sort(sort).skip(skip).limit(Number(limit)),
        Activity.countDocuments(q)
      ]);

      res.json({
        ok: true,
        data: items,
        meta: { page: Number(page), limit: Number(limit), total }
      });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  }
};
