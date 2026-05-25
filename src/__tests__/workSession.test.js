import { expect, test } from 'vitest';
import { WorkSession } from '../modules/workSessions/models/WorkSession.js';

test('WorkSession validates the MVP web meter payload', async () => {
  const session = new WorkSession({
    userId: '000000000000000000000001',
    clientId: '000000000000000000000002',
    caseId: '000000000000000000000003',
    activityType: 'research',
    activityCode: 'RESEARCH',
    narrative: 'Researching limitation issue',
    billable: true,
    timezone: 'Asia/Calcutta',
  });

  await expect(session.validate()).resolves.toBeUndefined();
  expect(session.status).toBe('running');
});
