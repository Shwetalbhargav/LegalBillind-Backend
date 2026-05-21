import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { AUTH_COOKIE_NAME, signAuthToken } from '../modules/auth/services/authTokenService.js';

const mocks = vi.hoisted(() => ({
  activityCreate: vi.fn(),
  activityFind: vi.fn(),
  activityFindById: vi.fn(),
  activityFindByIdAndUpdate: vi.fn(),
  activityFindOne: vi.fn(),
  activityCountDocuments: vi.fn(),
  activityUpdateOne: vi.fn(),
  caseFindById: vi.fn(),
  clientExists: vi.fn(),
  userExists: vi.fn(),
  assignmentFindOne: vi.fn(),
  rateCardFindOne: vi.fn(),
  timeEntryFindOne: vi.fn(),
  timeEntryCreate: vi.fn(),
}));

vi.mock('../modules/activities/models/Activity.js', () => {
  const Activity = {
    create: mocks.activityCreate,
    find: mocks.activityFind,
    findById: mocks.activityFindById,
    findByIdAndUpdate: mocks.activityFindByIdAndUpdate,
    findOne: mocks.activityFindOne,
    countDocuments: mocks.activityCountDocuments,
    updateOne: mocks.activityUpdateOne,
  };
  return { Activity, default: Activity };
});

vi.mock('../modules/cases/models/Case.js', () => ({
  Case: {
    findById: mocks.caseFindById,
  },
}));

vi.mock('../modules/cases/models/CaseAssignment.js', () => ({
  CaseAssignment: {
    findOne: mocks.assignmentFindOne,
  },
}));

vi.mock('../modules/clients/models/Client.js', () => ({
  Client: {
    exists: mocks.clientExists,
  },
}));

vi.mock('../modules/users/models/User.js', () => ({
  default: {
    exists: mocks.userExists,
  },
}));

vi.mock('../modules/rates/models/RateCard.js', () => ({
  RateCard: {
    findOne: mocks.rateCardFindOne,
  },
}));

vi.mock('../modules/timeEntries/models/TimeEntry.js', () => ({
  TimeEntry: {
    findOne: mocks.timeEntryFindOne,
    create: mocks.timeEntryCreate,
  },
}));

const { default: app } = await import('../app.js');

const ACTIVITY_ID = '64b000000000000000000021';
const CASE_ID = '64b000000000000000000022';
const CLIENT_ID = '64b000000000000000000023';
const USER_ID = '64b000000000000000000024';
const OTHER_USER_ID = '64b000000000000000000025';
const TIME_ENTRY_ID = '64b000000000000000000026';

let server;
let baseUrl;
let startSessionSpy;
let session;

const authCookie = (role = 'lawyer', userId = USER_ID) =>
  `${AUTH_COOKIE_NAME}=${signAuthToken({ _id: userId, role, email: `${role}@example.com` })}`;

const jsonRequest = (path, options = {}, role = 'lawyer', userId = USER_ID) =>
  fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      cookie: authCookie(role, userId),
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

const queryResult = (result) => {
  const query = {
    populate: vi.fn(() => query),
    sort: vi.fn(() => query),
    skip: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(result)),
    session: vi.fn(() => query),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (reject) => Promise.resolve(result).catch(reject),
  };
  return query;
};

beforeAll(async () => {
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

afterEach(() => {
  startSessionSpy?.mockRestore();
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());

  session = {
    withTransaction: vi.fn(async (callback) => callback()),
    endSession: vi.fn(async () => {}),
  };
  startSessionSpy = vi.spyOn(mongoose, 'startSession').mockResolvedValue(session);

  mocks.caseFindById.mockResolvedValue({
    _id: CASE_ID,
    clientId: CLIENT_ID,
    status: 'open',
    assignedUsers: [USER_ID],
  });
  mocks.clientExists.mockResolvedValue({ _id: CLIENT_ID });
  mocks.userExists.mockResolvedValue({ _id: USER_ID });
  mocks.assignmentFindOne.mockResolvedValue(null);
  mocks.activityFindOne.mockResolvedValue(null);
  mocks.activityCreate.mockImplementation(async (payload) => ({ _id: ACTIVITY_ID, ...payload }));
  mocks.activityFind.mockReturnValue(queryResult([]));
  mocks.activityFindById.mockResolvedValue({
    _id: ACTIVITY_ID,
    caseId: CASE_ID,
    clientId: CLIENT_ID,
    userId: USER_ID,
    activityType: 'research',
    activityCode: 'L100',
    narrative: 'Research memo',
    durationMinutes: 30,
    roundedDurationMinutes: 30,
    billable: true,
    status: 'captured',
    conversionStatus: 'unconverted',
  });
  mocks.activityCountDocuments.mockResolvedValue(0);
  mocks.activityFindByIdAndUpdate.mockImplementation(async (_id, update) => ({
    _id,
    status: update?.$set?.status || update?.status || 'captured',
    ...update?.$set,
  }));
  mocks.activityUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  mocks.rateCardFindOne.mockReturnValue(queryResult({ ratePerHour: 6000 }));
  mocks.timeEntryFindOne.mockResolvedValue(null);
  mocks.timeEntryCreate.mockImplementation(async ([payload]) => [{ _id: TIME_ENTRY_ID, ...payload }]);
});

test('POST /api/activities creates activity for the authenticated user by default', async () => {
  const response = await jsonRequest('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      clientId: CLIENT_ID,
      activityType: 'research',
      startedAt: '2026-05-20T09:00:00.000Z',
      endedAt: '2026-05-20T09:30:00.000Z',
      source: 'manual',
      narrative: 'Research memo',
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(201);
  expect(mocks.activityCreate).toHaveBeenCalledWith(expect.objectContaining({
    userId: USER_ID,
    durationMinutes: 30,
    roundedDurationMinutes: 30,
    workDate: expect.any(Date),
    billable: true,
    status: 'captured',
    source: 'manual',
    narrative: 'Research memo',
    auditTrail: [expect.objectContaining({ action: 'created', actorId: USER_ID })],
  }));
  expect(body.data.userId).toBe(USER_ID);
});

test('POST /api/activities rejects non-admin attempts to create for another user', async () => {
  const response = await jsonRequest('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      clientId: CLIENT_ID,
      userId: OTHER_USER_ID,
      activityType: 'research',
      durationMinutes: 15,
    }),
  });

  expect(response.status).toBe(403);
  expect(mocks.activityCreate).not.toHaveBeenCalled();
});

test('POST /api/activities allows admin override only after assignment checks', async () => {
  mocks.caseFindById.mockResolvedValue({
    _id: CASE_ID,
    clientId: CLIENT_ID,
    assignedUsers: [OTHER_USER_ID],
  });
  mocks.userExists.mockResolvedValue({ _id: OTHER_USER_ID });

  const response = await jsonRequest('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      clientId: CLIENT_ID,
      userId: OTHER_USER_ID,
      activityType: 'meeting',
      durationMinutes: 45,
    }),
  }, 'admin');

  expect(response.status).toBe(201);
  expect(mocks.activityCreate).toHaveBeenCalledWith(expect.objectContaining({
    userId: OTHER_USER_ID,
  }));
});

test('POST /api/activities rejects mismatched case and client', async () => {
  mocks.caseFindById.mockResolvedValue({
    _id: CASE_ID,
    clientId: OTHER_USER_ID,
    assignedUsers: [USER_ID],
  });

  const response = await jsonRequest('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      clientId: CLIENT_ID,
      activityType: 'call',
      durationMinutes: 10,
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.errors).toContainEqual({
    field: 'clientId',
    message: 'clientId must match the activity case client',
  });
  expect(mocks.activityCreate).not.toHaveBeenCalled();
});

test('POST /api/activities rejects endedAt before startedAt', async () => {
  const response = await jsonRequest('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      clientId: CLIENT_ID,
      activityType: 'meeting',
      startedAt: '2026-05-20T10:00:00.000Z',
      endedAt: '2026-05-20T09:00:00.000Z',
    }),
  });

  expect(response.status).toBe(400);
  expect(mocks.activityCreate).not.toHaveBeenCalled();
});

test('POST /api/activities requires either duration or a full time range', async () => {
  const response = await jsonRequest('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      clientId: CLIENT_ID,
      activityType: 'drafting',
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.errors).toContainEqual({
    field: 'durationMinutes',
    message: 'durationMinutes or both startedAt and endedAt are required',
  });
  expect(mocks.activityCreate).not.toHaveBeenCalled();
});

test('POST /api/activities is idempotent for repeated source events', async () => {
  const existing = { _id: ACTIVITY_ID, userId: USER_ID, source: 'gmail', sourceRef: 'gmail-message-1' };
  mocks.activityFindOne.mockResolvedValue(existing);

  const response = await jsonRequest('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      clientId: CLIENT_ID,
      activityType: 'email',
      durationMinutes: 5,
      source: 'gmail',
      sourceRef: 'gmail-message-1',
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.idempotent).toBe(true);
  expect(body.data).toEqual(existing);
  expect(mocks.activityCreate).not.toHaveBeenCalled();
});

test('POST /api/activities rejects non-admin duration above the policy limit', async () => {
  const response = await jsonRequest('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      clientId: CLIENT_ID,
      activityType: 'research',
      durationMinutes: 1441,
    }),
  });

  expect(response.status).toBe(400);
  expect(mocks.activityCreate).not.toHaveBeenCalled();
});

test('POST /api/activities lets admins override max duration with a reason', async () => {
  const response = await jsonRequest('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      clientId: CLIENT_ID,
      activityType: 'research',
      durationMinutes: 1500,
      durationOverrideReason: 'Historical import',
    }),
  }, 'admin');

  expect(response.status).toBe(201);
  expect(mocks.activityCreate).toHaveBeenCalledWith(expect.objectContaining({
    durationMinutes: 1500,
    durationOverrideReason: 'Historical import',
  }));
});

test('POST /api/activities applies rounding and billable flags before storage', async () => {
  const response = await jsonRequest('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      clientId: CLIENT_ID,
      activityType: 'drafting',
      durationMinutes: 7,
      roundingPolicy: 'six_minute',
      billable: false,
    }),
  });

  expect(response.status).toBe(201);
  expect(mocks.activityCreate).toHaveBeenCalledWith(expect.objectContaining({
    durationMinutes: 7,
    roundedDurationMinutes: 12,
    roundingPolicy: 'six_minute',
    billable: false,
  }));
});

test('POST /api/activities rejects overlapping work ranges for a lawyer', async () => {
  mocks.activityFindOne.mockResolvedValue({ _id: '64b000000000000000000099' });

  const response = await jsonRequest('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      clientId: CLIENT_ID,
      activityType: 'meeting',
      startedAt: '2026-05-20T09:00:00.000Z',
      endedAt: '2026-05-20T09:30:00.000Z',
    }),
  });

  expect(response.status).toBe(409);
  expect(mocks.activityCreate).not.toHaveBeenCalled();
});

test('POST /api/activities blocks closed cases for non-admin users', async () => {
  mocks.caseFindById.mockResolvedValue({
    _id: CASE_ID,
    clientId: CLIENT_ID,
    status: 'closed',
    assignedUsers: [USER_ID],
  });

  const response = await jsonRequest('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      clientId: CLIENT_ID,
      activityType: 'research',
      durationMinutes: 20,
    }),
  });

  expect(response.status).toBe(400);
  expect(mocks.activityCreate).not.toHaveBeenCalled();
});

test('GET /api/activities scopes non-admin list requests to the authenticated user', async () => {
  const query = queryResult([]);
  mocks.activityFind.mockReturnValue(query);

  const response = await jsonRequest('/api/activities?limit=100&from=2026-05-20T00:00:00.000Z&to=2026-05-20T23:59:59.999Z');

  expect(response.status).toBe(200);
  expect(mocks.activityFind).toHaveBeenCalledWith({
    userId: USER_ID,
    workDate: {
      $gte: expect.any(Date),
      $lte: expect.any(Date),
    },
  });
  expect(query.populate).toHaveBeenCalledWith('userId', 'name role email');
  expect(query.limit).toHaveBeenCalledWith(100);
});

test('GET /api/activities rejects non-admin requests for another user', async () => {
  const response = await jsonRequest(`/api/activities?userId=${OTHER_USER_ID}`);

  expect(response.status).toBe(403);
  expect(mocks.activityFind).not.toHaveBeenCalled();
});

test('GET /api/activities validates and caps pagination at 100', async () => {
  const response = await jsonRequest('/api/activities?limit=101');

  expect(response.status).toBe(400);
  expect(mocks.activityFind).not.toHaveBeenCalled();
});

test('PATCH /api/activities/:activityId rejects edits after conversion', async () => {
  mocks.activityFindById.mockResolvedValue({
    _id: ACTIVITY_ID,
    userId: USER_ID,
    status: 'converted',
  });

  const response = await jsonRequest(`/api/activities/${ACTIVITY_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({ narrative: 'Updated' }),
  });

  expect(response.status).toBe(409);
  expect(mocks.activityFindByIdAndUpdate).not.toHaveBeenCalled();
});

test('POST /api/activities/:activityId/void soft-voids activity with audit metadata', async () => {
  const response = await jsonRequest(`/api/activities/${ACTIVITY_ID}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Duplicate capture' }),
  });

  expect(response.status).toBe(200);
  expect(mocks.activityFindByIdAndUpdate).toHaveBeenCalledWith(
    ACTIVITY_ID,
    expect.objectContaining({
      $set: expect.objectContaining({
        status: 'voided',
        voidedBy: USER_ID,
        voidReason: 'Duplicate capture',
      }),
      $push: {
        auditTrail: expect.objectContaining({
          action: 'voided',
          actorId: USER_ID,
          reason: 'Duplicate capture',
        }),
      },
    }),
    { new: true, runValidators: true }
  );
});

test('POST /api/time-entries/from-activity/:activityId rejects duplicate conversion', async () => {
  mocks.timeEntryFindOne.mockResolvedValue({ _id: TIME_ENTRY_ID, activityId: ACTIVITY_ID });

  const response = await jsonRequest(`/api/time-entries/from-activity/${ACTIVITY_ID}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const body = await response.json();

  expect(response.status).toBe(409);
  expect(body.error).toBe('Activity has already been converted to a time entry');
  expect(mocks.timeEntryCreate).not.toHaveBeenCalled();
  expect(mocks.activityUpdateOne).not.toHaveBeenCalled();
});

test('POST /api/time-entries/from-activity/:activityId rejects ignored activity conversion', async () => {
  mocks.activityFindById.mockResolvedValue({
    _id: ACTIVITY_ID,
    caseId: CASE_ID,
    clientId: CLIENT_ID,
    userId: USER_ID,
    activityType: 'research',
    durationMinutes: 30,
    status: 'ignored',
    conversionStatus: 'unconverted',
  });

  const response = await jsonRequest(`/api/time-entries/from-activity/${ACTIVITY_ID}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  expect(response.status).toBe(409);
  expect(mocks.timeEntryCreate).not.toHaveBeenCalled();
});

test('POST /api/time-entries/from-activity/:activityId creates nonbillable entries from nonbillable activities', async () => {
  mocks.activityFindById.mockResolvedValue({
    _id: ACTIVITY_ID,
    caseId: CASE_ID,
    clientId: CLIENT_ID,
    userId: USER_ID,
    activityType: 'research',
    activityCode: 'L100',
    durationMinutes: 7,
    roundedDurationMinutes: 12,
    billable: false,
    status: 'captured',
    conversionStatus: 'unconverted',
  });

  const response = await jsonRequest(`/api/time-entries/from-activity/${ACTIVITY_ID}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  expect(response.status).toBe(201);
  expect(mocks.timeEntryCreate).toHaveBeenCalledWith([
    expect.objectContaining({
      billableMinutes: 0,
      nonbillableMinutes: 12,
      amount: 0,
    }),
  ], { session });
});

test('POST /api/time-entries/from-activity/:activityId creates time entry and marks activity converted in one transaction', async () => {
  const response = await jsonRequest(`/api/time-entries/from-activity/${ACTIVITY_ID}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const body = await response.json();

  expect(response.status).toBe(201);
  expect(session.withTransaction).toHaveBeenCalledTimes(1);
  expect(mocks.timeEntryCreate).toHaveBeenCalledWith([
    expect.objectContaining({
      activityId: ACTIVITY_ID,
      billableMinutes: 30,
      rateApplied: 6000,
      amount: 3000,
    }),
  ], { session });
  expect(mocks.activityUpdateOne).toHaveBeenCalledWith(
    { _id: ACTIVITY_ID },
    expect.objectContaining({
      $set: expect.objectContaining({
        conversionStatus: 'converted',
        status: 'converted',
        convertedTimeEntryId: TIME_ENTRY_ID,
        convertedAt: expect.any(Date),
      }),
      $push: {
        auditTrail: expect.objectContaining({
          action: 'converted',
          actorId: USER_ID,
        }),
      },
    }),
    { session }
  );
  expect(body._id).toBe(TIME_ENTRY_ID);
});
