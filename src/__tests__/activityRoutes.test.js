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
  timeEntryFindById: vi.fn(),
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
    findById: mocks.timeEntryFindById,
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

const activityDoc = (overrides = {}) => ({
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
  ...overrides,
});

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
  mocks.activityFindById.mockResolvedValue(activityDoc());
  mocks.activityCountDocuments.mockResolvedValue(0);
  mocks.activityFindByIdAndUpdate.mockImplementation(async (_id, update) => ({
    _id,
    status: update?.$set?.status || update?.status || 'captured',
    ...update?.$set,
  }));
  mocks.activityUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  mocks.rateCardFindOne.mockReturnValue(queryResult({ ratePerHour: 6000 }));
  mocks.timeEntryFindOne.mockResolvedValue(null);
  mocks.timeEntryFindById.mockResolvedValue(null);
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
      durationMinutes: 181,
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
      durationMinutes: 240,
      durationOverrideReason: 'Historical import',
    }),
  }, 'admin');

  expect(response.status).toBe(201);
  expect(mocks.activityCreate).toHaveBeenCalledWith(expect.objectContaining({
    durationMinutes: 240,
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

test('POST /api/activities allows adjacent work ranges at the overlap boundary', async () => {
  const response = await jsonRequest('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      clientId: CLIENT_ID,
      activityType: 'meeting',
      startedAt: '2026-05-20T09:30:00.000Z',
      endedAt: '2026-05-20T10:00:00.000Z',
    }),
  });

  const overlapQuery = mocks.activityFindOne.mock.calls[0][0];

  expect(response.status).toBe(201);
  expect(overlapQuery.startedAt.$lt.toISOString()).toBe('2026-05-20T10:00:00.000Z');
  expect(overlapQuery.endedAt.$gt.toISOString()).toBe('2026-05-20T09:30:00.000Z');
  expect(mocks.activityCreate).toHaveBeenCalled();
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

test('POST /api/activities rejects overlong text fields before storage', async () => {
  const basePayload = {
    caseId: CASE_ID,
    clientId: CLIENT_ID,
    activityType: 'research',
    durationMinutes: 30,
  };
  const cases = [
    ['narrative', 'x'.repeat(2001)],
    ['sourceRef', 'x'.repeat(256)],
    ['activityCode', 'x'.repeat(81)],
    ['timezone', 'x'.repeat(81)],
  ];

  for (const [field, value] of cases) {
    const response = await jsonRequest('/api/activities', {
      method: 'POST',
      body: JSON.stringify({ ...basePayload, [field]: value }),
    });

    expect(response.status).toBe(400);
  }

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

test('GET /api/activities applies source, billable, sort, pagination, and date boundary filters', async () => {
  const query = queryResult([]);
  mocks.activityFind.mockReturnValue(query);

  const response = await jsonRequest(
    '/api/activities?source=manual&billable=false&status=captured&activityType=research&from=2026-05-20T00:00:00.000Z&to=2026-05-20T00:00:00.000Z&page=2&limit=10&sort=-createdAt'
  );

  const findQuery = mocks.activityFind.mock.calls[0][0];

  expect(response.status).toBe(200);
  expect(findQuery).toEqual({
    userId: USER_ID,
    source: 'manual',
    billable: false,
    status: 'captured',
    activityType: 'research',
    workDate: {
      $gte: expect.any(Date),
      $lte: expect.any(Date),
    },
  });
  expect(findQuery.workDate.$gte.toISOString()).toBe('2026-05-20T00:00:00.000Z');
  expect(findQuery.workDate.$lte.toISOString()).toBe('2026-05-20T00:00:00.000Z');
  expect(query.sort).toHaveBeenCalledWith('-createdAt');
  expect(query.skip).toHaveBeenCalledWith(10);
  expect(query.limit).toHaveBeenCalledWith(10);
});

test('GET /api/activities rejects invalid sort, page, and inverted date range', async () => {
  const invalidSort = await jsonRequest('/api/activities?sort=-bad');
  const invalidPage = await jsonRequest('/api/activities?page=0');
  const invalidRange = await jsonRequest('/api/activities?from=2026-05-21T00:00:00.000Z&to=2026-05-20T00:00:00.000Z');

  expect(invalidSort.status).toBe(400);
  expect(invalidPage.status).toBe(400);
  expect(invalidRange.status).toBe(400);
  expect(mocks.activityFind).not.toHaveBeenCalled();
});

test('GET /api/activities validates and caps pagination at 100', async () => {
  const response = await jsonRequest('/api/activities?limit=101');

  expect(response.status).toBe(400);
  expect(mocks.activityFind).not.toHaveBeenCalled();
});

test('GET /api/activities keeps partner list visibility scoped to self', async () => {
  const response = await jsonRequest(
    `/api/activities?userId=${OTHER_USER_ID}`,
    {},
    'partner',
    USER_ID
  );

  expect(response.status).toBe(403);
  expect(mocks.activityFind).not.toHaveBeenCalled();
});

test('GET /api/activities/:activityId returns 404 when missing', async () => {
  mocks.activityFindById.mockResolvedValue(null);

  const response = await jsonRequest(`/api/activities/${ACTIVITY_ID}`);

  expect(response.status).toBe(404);
});

test('GET /api/activities/:activityId rejects non-owner access for non-admin users', async () => {
  mocks.activityFindById.mockResolvedValue(activityDoc({ userId: OTHER_USER_ID }));

  const response = await jsonRequest(`/api/activities/${ACTIVITY_ID}`);

  expect(response.status).toBe(403);
});

test('GET /api/activities/:activityId allows admin access to another user activity', async () => {
  mocks.activityFindById.mockResolvedValue(activityDoc({ userId: OTHER_USER_ID }));

  const response = await jsonRequest(`/api/activities/${ACTIVITY_ID}`, {}, 'admin');
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.data.userId).toBe(OTHER_USER_ID);
});

test('PATCH /api/activities/:activityId updates editable fields with audit metadata', async () => {
  const response = await jsonRequest(`/api/activities/${ACTIVITY_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({
      narrative: 'Updated memo',
      durationMinutes: 45,
    }),
  });

  expect(response.status).toBe(200);
  expect(mocks.activityFindByIdAndUpdate).toHaveBeenCalledWith(
    ACTIVITY_ID,
    expect.objectContaining({
      $set: expect.objectContaining({
        narrative: 'Updated memo',
        durationMinutes: 45,
        roundedDurationMinutes: 45,
        updatedBy: USER_ID,
      }),
      $push: {
        auditTrail: expect.objectContaining({
          action: 'updated',
          actorId: USER_ID,
          changes: {
            narrative: 'Updated memo',
            durationMinutes: 45,
          },
        }),
      },
    }),
    { new: true, runValidators: true }
  );
});

test('PATCH /api/activities/:activityId rejects unknown fields, empty body, and invalid enum values', async () => {
  const unknownField = await jsonRequest(`/api/activities/${ACTIVITY_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({ caseId: CASE_ID }),
  });
  const emptyBody = await jsonRequest(`/api/activities/${ACTIVITY_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
  const invalidEnum = await jsonRequest(`/api/activities/${ACTIVITY_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({ activityType: 'coffee' }),
  });

  expect(unknownField.status).toBe(400);
  expect(emptyBody.status).toBe(400);
  expect(invalidEnum.status).toBe(400);
  expect(mocks.activityFindByIdAndUpdate).not.toHaveBeenCalled();
});

test('PATCH /api/activities/:activityId returns conflict for duplicate sourceRef', async () => {
  mocks.activityFindByIdAndUpdate.mockRejectedValue({ code: 11000 });

  const response = await jsonRequest(`/api/activities/${ACTIVITY_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({ source: 'gmail', sourceRef: 'gmail-message-1' }),
  });

  expect(response.status).toBe(409);
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

test('Lifecycle actions reject non-owner activity changes for non-admin users', async () => {
  const actions = ['review', 'ignore', 'lock', 'void'];

  for (const action of actions) {
    mocks.activityFindById.mockResolvedValue(activityDoc({ userId: OTHER_USER_ID }));

    const response = await jsonRequest(`/api/activities/${ACTIVITY_ID}/${action}`, {
      method: 'POST',
      body: JSON.stringify(action === 'review' ? {} : { reason: 'Not needed' }),
    });

    expect(response.status).toBe(403);
  }

  expect(mocks.activityFindByIdAndUpdate).not.toHaveBeenCalled();
});

test('Lifecycle actions reject converted, locked, and voided activities', async () => {
  const cases = [
    ['review', 'converted'],
    ['ignore', 'converted'],
    ['lock', 'converted'],
    ['void', 'converted'],
    ['review', 'locked'],
    ['ignore', 'locked'],
    ['lock', 'locked'],
    ['void', 'locked'],
    ['review', 'voided'],
    ['ignore', 'voided'],
    ['lock', 'voided'],
    ['void', 'voided'],
  ];

  for (const [action, status] of cases) {
    mocks.activityFindById.mockResolvedValue(activityDoc({ status }));

    const response = await jsonRequest(`/api/activities/${ACTIVITY_ID}/${action}`, {
      method: 'POST',
      body: JSON.stringify(action === 'review' ? {} : { reason: 'Status is final' }),
    });

    expect(response.status).toBe(409);
  }

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

test('DELETE /api/activities/:activityId soft-voids activity as a delete lifecycle action', async () => {
  const response = await jsonRequest(`/api/activities/${ACTIVITY_ID}`, {
    method: 'DELETE',
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
          action: 'deleted',
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

test('POST /api/time-entries/:id/submit records submit metadata', async () => {
  const entry = {
    _id: TIME_ENTRY_ID,
    userId: USER_ID,
    status: 'draft',
    narrative: 'Research memo',
    billableMinutes: 30,
    nonbillableMinutes: 0,
    rateApplied: 6000,
    save: vi.fn(async function save() {
      return this;
    }),
  };
  mocks.timeEntryFindById.mockResolvedValue(entry);

  const response = await jsonRequest(`/api/time-entries/${TIME_ENTRY_ID}/submit`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(entry.status).toBe('submitted');
  expect(entry.submittedAt).toBeInstanceOf(Date);
  expect(entry.submittedBy).toBe(USER_ID);
  expect(entry.save).toHaveBeenCalledTimes(1);
  expect(body.status).toBe('submitted');
});

test('POST /api/time-entries/:id/approve is reviewer-only and blocks self-approval', async () => {
  const entry = {
    _id: TIME_ENTRY_ID,
    userId: USER_ID,
    status: 'submitted',
    save: vi.fn(async function save() {
      return this;
    }),
  };
  mocks.timeEntryFindById.mockResolvedValue(entry);

  const selfReview = await jsonRequest(`/api/time-entries/${TIME_ENTRY_ID}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, 'partner', USER_ID);

  expect(selfReview.status).toBe(403);
  expect(entry.save).not.toHaveBeenCalled();

  const reviewerReview = await jsonRequest(`/api/time-entries/${TIME_ENTRY_ID}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, 'partner', OTHER_USER_ID);

  expect(reviewerReview.status).toBe(200);
  expect(entry.status).toBe('approved');
  expect(entry.reviewedAt).toBeInstanceOf(Date);
  expect(entry.reviewedBy).toBe(OTHER_USER_ID);
});

test('POST /api/time-entries/:id/reject requires and stores a reason', async () => {
  const entry = {
    _id: TIME_ENTRY_ID,
    userId: USER_ID,
    status: 'submitted',
    save: vi.fn(async function save() {
      return this;
    }),
  };
  mocks.timeEntryFindById.mockResolvedValue(entry);

  const missingReason = await jsonRequest(`/api/time-entries/${TIME_ENTRY_ID}/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, 'partner', OTHER_USER_ID);

  expect(missingReason.status).toBe(400);
  expect(entry.save).not.toHaveBeenCalled();

  const response = await jsonRequest(`/api/time-entries/${TIME_ENTRY_ID}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Narrative needs more detail' }),
  }, 'partner', OTHER_USER_ID);

  expect(response.status).toBe(200);
  expect(entry.status).toBe('rejected');
  expect(entry.rejectionReason).toBe('Narrative needs more detail');
  expect(entry.reviewedBy).toBe(OTHER_USER_ID);
});
