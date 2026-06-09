import { date, objectId, oneOf, required, string, validateBody, validateParams, validateQuery } from '../../../middleware/validate.js';

const taskStatuses = ['todo', 'in_progress', 'blocked', 'done', 'cancelled'];
const taskPriorities = ['low', 'normal', 'high', 'urgent'];

export const validateTaskId = validateParams({
  taskId: [required, objectId()],
});

export const validateListTasks = validateQuery({
  caseId: [objectId()],
  clientId: [objectId()],
  assignedTo: [objectId()],
  createdBy: [objectId()],
  status: [oneOf(taskStatuses)],
  priority: [oneOf(taskPriorities)],
  dueFrom: [date()],
  dueTo: [date()],
});

export const validateCreateTask = validateBody({
  title: [required, string({ min: 1, max: 240 })],
  description: [string({ max: 2000 })],
  caseId: [required, objectId()],
  clientId: [required, objectId()],
  assignedTo: [required, objectId()],
  dueDate: [date()],
  priority: [oneOf(taskPriorities)],
  status: [oneOf(taskStatuses)],
});

export const validateUpdateTask = validateBody({
  title: [string({ min: 1, max: 240 })],
  description: [string({ max: 2000 })],
  assignedTo: [objectId()],
  dueDate: [date()],
  priority: [oneOf(taskPriorities)],
  status: [oneOf(taskStatuses)],
});
