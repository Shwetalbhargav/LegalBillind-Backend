import { expect, test } from 'vitest';
import { Task } from '../modules/tasks/models/Task.js';

test('Task validates assignment, due date, status, and checklist', async () => {
  const task = new Task({
    title: 'Prepare daily matter update',
    caseId: '000000000000000000000001',
    clientId: '000000000000000000000002',
    assignedTo: '000000000000000000000003',
    createdBy: '000000000000000000000004',
    dueDate: new Date('2026-06-10T10:00:00.000Z'),
    status: 'in_progress',
    priority: 'high',
    checklist: [
      { text: 'Review latest order', done: true, completedBy: '000000000000000000000004' },
      { text: 'Draft client note', done: false },
    ],
  });

  await expect(task.validate()).resolves.toBeUndefined();
  expect(task.checklist).toHaveLength(2);
  expect(task.status).toBe('in_progress');
});

test('Task sets completion metadata when marked done', async () => {
  const task = new Task({
    title: 'File hearing note',
    caseId: '000000000000000000000001',
    clientId: '000000000000000000000002',
    assignedTo: '000000000000000000000003',
    createdBy: '000000000000000000000004',
    status: 'done',
  });

  await expect(task.validate()).resolves.toBeUndefined();
  expect(task.completedAt).toBeInstanceOf(Date);
});
