import { Task } from '../models/Task.js';
import { Case } from '../../cases/models/Case.js';
import User from '../../users/models/User.js';

const idString = (value) => (value === undefined || value === null ? '' : String(value._id || value));
const managerRoles = ['admin', 'partner'];

const canManageAll = (req) => managerRoles.includes(String(req.user?.role || '').toLowerCase());

const canReadTask = (task, req) =>
  canManageAll(req) ||
  idString(task.assignedTo) === req.user?.id ||
  idString(task.createdBy) === req.user?.id;

const canEditTask = canReadTask;

const populateTask = (query) =>
  query
    .populate('caseId', 'title name status')
    .populate('clientId', 'displayName name')
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email role');

function cleanChecklist(items = [], actorId) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && String(item.text || '').trim())
    .map((item) => ({
      text: String(item.text).trim().slice(0, 300),
      done: Boolean(item.done),
      completedAt: item.done ? item.completedAt || new Date() : undefined,
      completedBy: item.done ? item.completedBy || actorId : undefined,
    }));
}

async function validateReferences({ caseId, clientId, assignedTo }) {
  const [caseDoc, assignee] = await Promise.all([
    Case.findById(caseId).select('clientId status assignedUsers leadPartnerId managingLawyerId primaryLawyerId'),
    User.findById(assignedTo).select('_id role'),
  ]);

  const errors = [];
  if (!caseDoc) errors.push({ field: 'caseId', message: 'caseId does not reference an existing matter' });
  if (caseDoc && String(caseDoc.clientId) !== String(clientId)) {
    errors.push({ field: 'clientId', message: 'clientId must match the selected matter client' });
  }
  if (!assignee) errors.push({ field: 'assignedTo', message: 'assignedTo does not reference an existing user' });
  return errors;
}

function taskPatch(body, actorId) {
  const patch = {};
  for (const field of ['title', 'description', 'assignedTo', 'dueDate', 'priority', 'status']) {
    if (Object.prototype.hasOwnProperty.call(body, field)) patch[field] = body[field] || undefined;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'checklist')) {
    patch.checklist = cleanChecklist(body.checklist, actorId);
  }
  if (patch.status === 'done') {
    patch.completedAt = new Date();
    patch.completedBy = actorId;
  }
  if (patch.status && patch.status !== 'done') {
    patch.completedAt = undefined;
    patch.completedBy = undefined;
  }
  return patch;
}

export const TaskController = {
  async list(req, res) {
    try {
      const q = {};
      for (const field of ['caseId', 'clientId', 'assignedTo', 'createdBy', 'status', 'priority']) {
        if (req.query[field]) q[field] = req.query[field];
      }
      if (req.query.dueFrom || req.query.dueTo) {
        q.dueDate = {};
        if (req.query.dueFrom) q.dueDate.$gte = new Date(req.query.dueFrom);
        if (req.query.dueTo) q.dueDate.$lte = new Date(req.query.dueTo);
      }
      if (!canManageAll(req)) {
        q.$or = [{ assignedTo: req.user.id }, { createdBy: req.user.id }];
      }

      const rows = await populateTask(Task.find(q))
        .sort({ status: 1, dueDate: 1, createdAt: -1 })
        .limit(200);
      res.json({ ok: true, data: rows });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async create(req, res) {
    try {
      const referenceErrors = await validateReferences(req.body);
      if (referenceErrors.length) {
        return res.status(400).json({ ok: false, message: 'Validation failed', errors: referenceErrors });
      }

      const doc = await Task.create({
        title: req.body.title,
        description: req.body.description,
        caseId: req.body.caseId,
        clientId: req.body.clientId,
        assignedTo: req.body.assignedTo,
        createdBy: req.user.id,
        dueDate: req.body.dueDate,
        priority: req.body.priority || 'normal',
        status: req.body.status || 'todo',
        checklist: cleanChecklist(req.body.checklist, req.user.id),
      });

      const populated = await populateTask(Task.findById(doc._id));
      res.status(201).json({ ok: true, data: populated });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async update(req, res) {
    try {
      const task = await Task.findById(req.params.taskId);
      if (!task) return res.status(404).json({ ok: false, message: 'Task not found' });
      if (!canEditTask(task, req)) return res.status(403).json({ ok: false, message: 'You can only edit assigned or created tasks' });

      if (req.body.assignedTo) {
        const assignee = await User.exists({ _id: req.body.assignedTo });
        if (!assignee) {
          return res.status(400).json({ ok: false, message: 'Validation failed', errors: [{ field: 'assignedTo', message: 'assignedTo does not reference an existing user' }] });
        }
      }

      const patch = taskPatch(req.body, req.user.id);
      const updated = await populateTask(Task.findByIdAndUpdate(task._id, { $set: patch }, { new: true, runValidators: true }));
      res.json({ ok: true, data: updated });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async getById(req, res) {
    try {
      const task = await populateTask(Task.findById(req.params.taskId));
      if (!task) return res.status(404).json({ ok: false, message: 'Task not found' });
      if (!canReadTask(task, req)) return res.status(403).json({ ok: false, message: 'You can only view assigned or created tasks' });
      res.json({ ok: true, data: task });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async remove(req, res) {
    try {
      const task = await Task.findById(req.params.taskId);
      if (!task) return res.status(404).json({ ok: false, message: 'Task not found' });
      if (!canManageAll(req) && idString(task.createdBy) !== req.user?.id) {
        return res.status(403).json({ ok: false, message: 'Only managers or task creators can delete tasks' });
      }
      await task.deleteOne();
      res.json({ ok: true, data: { deleted: true } });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },
};
