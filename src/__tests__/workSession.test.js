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
    heartbeatCount: 2,
    lastUrl: 'https://mail.google.com',
    webMeter: {
      mode: 'manual_web_activity',
      captureLevel: 'active_window',
      idleAfterSeconds: 300,
      maxSessionMinutes: 180,
      inactiveSeconds: 12,
      activitySignals: ['started', 'heartbeat'],
    },
  });

  await expect(session.validate()).resolves.toBeUndefined();
  expect(session.status).toBe('running');
  expect(session.webMeter.captureLevel).toBe('active_window');
});

test('WorkSession accepts hearing calendar attachment metadata', async () => {
  const session = new WorkSession({
    userId: '000000000000000000000001',
    clientId: '000000000000000000000002',
    caseId: '000000000000000000000003',
    activityType: 'hearing',
    workTool: 'court',
    narrative: 'Court hearing for interim relief',
    calendarEvent: {
      title: 'Interim relief hearing',
      scheduledStart: new Date('2026-06-10T05:30:00.000Z'),
      scheduledEnd: new Date('2026-06-10T06:30:00.000Z'),
      courtName: 'Bombay High Court',
      courtroom: 'Court 4',
      judgeOrBench: 'Single bench',
      externalCalendarId: 'google:event-123',
    },
  });

  await expect(session.validate()).resolves.toBeUndefined();
  expect(session.calendarEvent.courtName).toBe('Bombay High Court');
  expect(session.calendarEvent.scheduledStart.toISOString()).toBe('2026-06-10T05:30:00.000Z');
});
