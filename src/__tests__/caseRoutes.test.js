import { createServer } from 'node:http';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { AUTH_COOKIE_NAME, signAuthToken } from '../modules/auth/services/authTokenService.js';

const mocks = vi.hoisted(() => ({
  caseCreate: vi.fn(),
  caseFind: vi.fn(),
  caseFindById: vi.fn(),
  caseFindByIdAndUpdate: vi.fn(),
  caseFindByIdAndDelete: vi.fn(),
  caseUpdateOne: vi.fn(),
  caseExists: vi.fn(),
  caseCountDocuments: vi.fn(),
  clientExists: vi.fn(),
  userExists: vi.fn(),
  userFindById: vi.fn(),
  timeEntryFind: vi.fn(),
  timeEntryCountDocuments: vi.fn(),
  invoiceFind: vi.fn(),
  paymentFind: vi.fn(),
  paymentCountDocuments: vi.fn(),
  assignmentFind: vi.fn(),
  assignmentFindOne: vi.fn(),
  assignmentCreate: vi.fn(),
  assignmentFindById: vi.fn(),
  assignmentFindByIdAndUpdate: vi.fn(),
  assignmentDeleteOne: vi.fn(),
  assignmentCountDocuments: vi.fn(),
}));

vi.mock('../modules/cases/models/Case.js', () => {
  const Case = {
    create: mocks.caseCreate,
    find: mocks.caseFind,
    findById: mocks.caseFindById,
    findByIdAndUpdate: mocks.caseFindByIdAndUpdate,
    findByIdAndDelete: mocks.caseFindByIdAndDelete,
    updateOne: mocks.caseUpdateOne,
    exists: mocks.caseExists,
    countDocuments: mocks.caseCountDocuments,
  };
  return { Case, default: Case };
});

vi.mock('../modules/cases/models/CaseAssignment.js', () => {
  const CaseAssignment = {
    find: mocks.assignmentFind,
    findOne: mocks.assignmentFindOne,
    create: mocks.assignmentCreate,
    findById: mocks.assignmentFindById,
    findByIdAndUpdate: mocks.assignmentFindByIdAndUpdate,
    deleteOne: mocks.assignmentDeleteOne,
    countDocuments: mocks.assignmentCountDocuments,
  };
  return { CaseAssignment, default: CaseAssignment };
});

vi.mock('../modules/clients/models/Client.js', () => ({
  Client: {
    exists: mocks.clientExists,
  },
}));

vi.mock('../modules/users/models/User.js', () => ({
  default: {
    exists: mocks.userExists,
    findById: mocks.userFindById,
  },
}));

vi.mock('../modules/timeEntries/models/TimeEntry.js', () => ({
  TimeEntry: {
    find: mocks.timeEntryFind,
    countDocuments: mocks.timeEntryCountDocuments,
  },
}));

vi.mock('../modules/invoices/models/Invoice.js', () => ({
  Invoice: {
    find: mocks.invoiceFind,
  },
}));

vi.mock('../modules/payments/models/Payment.js', () => ({
  Payment: {
    find: mocks.paymentFind,
    countDocuments: mocks.paymentCountDocuments,
  },
}));

const { default: app } = await import('../app.js');

const CASE_ID = '64b000000000000000000011';
const CLIENT_ID = '64b000000000000000000012';
const USER_ID = '64b000000000000000000013';
const SECOND_USER_ID = '64b000000000000000000014';
const INVOICE_ID = '64b000000000000000000015';
const ASSIGNMENT_ID = '64b000000000000000000016';

let server;
let baseUrl;

const authCookie = (role = 'admin') =>
  `${AUTH_COOKIE_NAME}=${signAuthToken({ _id: USER_ID, role, email: `${role}@example.com` })}`;

const jsonRequest = (path, options = {}, role = 'admin') =>
  fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      cookie: authCookie(role),
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

const queryResult = (result) => {
  const query = {
    select: vi.fn(() => query),
    populate: vi.fn(() => query),
    sort: vi.fn(() => query),
    skip: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(result)),
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

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.clientExists.mockResolvedValue({ _id: CLIENT_ID });
  mocks.userExists.mockResolvedValue({ _id: USER_ID });
  mocks.userFindById.mockResolvedValue({ _id: USER_ID, role: 'lawyer' });
  mocks.caseCreate.mockImplementation(async (payload) => ({ _id: CASE_ID, ...payload }));
  mocks.caseFind.mockReturnValue(queryResult([]));
  mocks.caseFindById.mockReturnValue(queryResult({
    _id: CASE_ID,
    title: 'Matter',
    clientId: CLIENT_ID,
    openedAt: new Date('2026-05-01T00:00:00.000Z'),
    closedAt: null,
  }));
  mocks.caseFindByIdAndUpdate.mockImplementation(async (_id, update) => ({ _id, ...update }));
  mocks.caseFindByIdAndDelete.mockResolvedValue({ _id: CASE_ID });
  mocks.caseUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  mocks.caseExists.mockResolvedValue(null);
  mocks.caseCountDocuments.mockResolvedValue(0);
  mocks.timeEntryFind.mockReturnValue(queryResult([]));
  mocks.timeEntryCountDocuments.mockResolvedValue(0);
  mocks.invoiceFind.mockReturnValue(queryResult([]));
  mocks.paymentFind.mockReturnValue(queryResult([]));
  mocks.paymentCountDocuments.mockResolvedValue(0);
  mocks.assignmentFind.mockReturnValue(queryResult([]));
  mocks.assignmentFindOne.mockResolvedValue(null);
  mocks.assignmentCreate.mockImplementation(async (payload) => ({ _id: ASSIGNMENT_ID, status: 'active', ...payload }));
  mocks.assignmentFindById.mockResolvedValue({
    _id: ASSIGNMENT_ID,
    caseId: CASE_ID,
    userId: USER_ID,
    status: 'active',
  });
  mocks.assignmentFindByIdAndUpdate.mockImplementation(async (_id, update) => ({ _id, ...update }));
  mocks.assignmentDeleteOne.mockResolvedValue({ deletedCount: 1 });
  mocks.assignmentCountDocuments.mockResolvedValue(0);
});

test('GET /api/cases/:caseId rejects invalid case ids before hitting the database', async () => {
  const response = await jsonRequest('/api/cases/not-a-valid-id');
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body).toMatchObject({ ok: false, message: 'Validation failed' });
  expect(mocks.caseFindById).not.toHaveBeenCalled();
});

test('POST /api/cases enforces RBAC for write routes', async () => {
  const response = await jsonRequest('/api/cases', {
    method: 'POST',
    body: JSON.stringify({ clientId: CLIENT_ID, title: 'Matter' }),
  }, 'intern');

  expect(response.status).toBe(403);
  expect(mocks.caseCreate).not.toHaveBeenCalled();
});

test('POST /api/cases validates referenced client and users', async () => {
  mocks.clientExists.mockResolvedValue(null);

  const response = await jsonRequest('/api/cases', {
    method: 'POST',
    body: JSON.stringify({
      clientId: CLIENT_ID,
      title: 'Matter',
      primaryLawyerId: USER_ID,
      assignedUsers: [SECOND_USER_ID],
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.errors).toContainEqual({
    field: 'clientId',
    message: 'clientId does not reference an existing client',
  });
  expect(mocks.caseCreate).not.toHaveBeenCalled();
});

test('POST /api/cases creates with the canonical payload after reference checks', async () => {
  const response = await jsonRequest('/api/cases', {
    method: 'POST',
    body: JSON.stringify({
      clientId: CLIENT_ID,
      title: '  Matter  ',
      description: 'Internal notes',
      status: 'open',
      billingType: 'hourly',
      primaryLawyerId: USER_ID,
      assignedUsers: [USER_ID, SECOND_USER_ID],
      case_type: 'Tax',
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(201);
  expect(mocks.clientExists).toHaveBeenCalledWith({ _id: CLIENT_ID });
  expect(mocks.userExists).toHaveBeenCalledWith({ _id: USER_ID });
  expect(mocks.userExists).toHaveBeenCalledWith({ _id: SECOND_USER_ID });
  expect(mocks.caseCreate).toHaveBeenCalledWith(expect.objectContaining({
    clientId: CLIENT_ID,
    title: 'Matter',
    assignedUsers: [USER_ID, SECOND_USER_ID],
  }));
  expect(body.data.title).toBe('Matter');
});

test('POST /api/cases rejects duplicate case titles for the same client', async () => {
  mocks.caseExists.mockResolvedValue({ _id: '64b000000000000000000099' });

  const response = await jsonRequest('/api/cases', {
    method: 'POST',
    body: JSON.stringify({
      clientId: CLIENT_ID,
      title: 'Matter',
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(409);
  expect(body.message).toBe('Case title already exists for this client');
  expect(mocks.caseCreate).not.toHaveBeenCalled();
});

test('POST /api/cases rejects closedAt before openedAt', async () => {
  const response = await jsonRequest('/api/cases', {
    method: 'POST',
    body: JSON.stringify({
      clientId: CLIENT_ID,
      title: 'Matter',
      status: 'closed',
      openedAt: '2026-05-21T10:00:00.000Z',
      closedAt: '2026-05-20T10:00:00.000Z',
    }),
  });

  expect(response.status).toBe(400);
  expect(mocks.caseCreate).not.toHaveBeenCalled();
});

test('GET /api/cases supports filtering and pagination', async () => {
  const query = queryResult([{ _id: CASE_ID, title: 'Matter' }]);
  mocks.caseFind.mockReturnValue(query);
  mocks.caseCountDocuments.mockResolvedValue(1);

  const response = await jsonRequest(`/api/cases?page=2&limit=10&status=open&clientId=${CLIENT_ID}&q=Matter`);
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(mocks.caseFind).toHaveBeenCalledWith(expect.objectContaining({
    clientId: CLIENT_ID,
    status: 'open',
    $or: expect.any(Array),
  }));
  expect(query.skip).toHaveBeenCalledWith(10);
  expect(query.limit).toHaveBeenCalledWith(10);
  expect(body.meta).toEqual({
    page: 2,
    limit: 10,
    total: 1,
    totalPages: 1,
  });
});

test('PUT /api/cases/:caseId rejects unknown payload fields', async () => {
  const response = await jsonRequest(`/api/cases/${CASE_ID}`, {
    method: 'PUT',
    body: JSON.stringify({ client_id: CLIENT_ID }),
  });
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.errors).toContainEqual({ field: 'client_id', message: 'client_id is not allowed' });
  expect(mocks.caseFindByIdAndUpdate).not.toHaveBeenCalled();
});

test('PUT /api/cases/:caseId runs mongoose validators and uses an allowlisted update payload', async () => {
  const response = await jsonRequest(`/api/cases/${CASE_ID}`, {
    method: 'PUT',
    body: JSON.stringify({ title: '  Updated Matter  ', status: 'pending' }),
  });

  expect(response.status).toBe(200);
  expect(mocks.caseFindByIdAndUpdate).toHaveBeenCalledWith(
    CASE_ID,
    { $set: { title: 'Updated Matter', status: 'pending' }, $unset: { closedAt: '' } },
    { new: true, runValidators: true }
  );
});

test('PUT /api/cases/:caseId sets closedAt when the regular update path closes a case', async () => {
  const response = await jsonRequest(`/api/cases/${CASE_ID}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'closed' }),
  });

  expect(response.status).toBe(200);
  expect(mocks.caseFindByIdAndUpdate).toHaveBeenCalledWith(
    CASE_ID,
    expect.objectContaining({
      status: 'closed',
      closedAt: expect.any(Date),
    }),
    { new: true, runValidators: true }
  );
});

test('PATCH /api/cases/:caseId/status sets closedAt when closing', async () => {
  const response = await jsonRequest(`/api/cases/${CASE_ID}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'closed' }),
  });

  expect(response.status).toBe(200);
  expect(mocks.caseFindByIdAndUpdate).toHaveBeenCalledWith(
    CASE_ID,
    expect.objectContaining({
      status: 'closed',
      closedAt: expect.any(Date),
    }),
    { new: true, runValidators: true }
  );
});

test('PATCH /api/cases/:caseId/status clears closedAt when reopening', async () => {
  const response = await jsonRequest(`/api/cases/${CASE_ID}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'open' }),
  });

  expect(response.status).toBe(200);
  expect(mocks.caseFindByIdAndUpdate).toHaveBeenCalledWith(
    CASE_ID,
    { $set: { status: 'open' }, $unset: { closedAt: '' } },
    { new: true, runValidators: true }
  );
});

test('DELETE /api/cases/:caseId archives instead of hard-deleting when related records exist', async () => {
  mocks.caseFindById.mockReturnValue(queryResult({ _id: CASE_ID, title: 'Matter', closedAt: null }));
  mocks.timeEntryCountDocuments.mockResolvedValue(2);
  mocks.invoiceFind.mockReturnValue(queryResult([{ _id: INVOICE_ID }]));
  mocks.paymentCountDocuments.mockResolvedValue(1);
  mocks.assignmentCountDocuments.mockResolvedValue(1);

  const response = await jsonRequest(`/api/cases/${CASE_ID}`, { method: 'DELETE' });
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.archived).toBe(true);
  expect(body.details).toEqual({
    timeEntries: 2,
    invoices: 1,
    payments: 1,
    assignments: 1,
  });
  expect(mocks.caseFindByIdAndUpdate).toHaveBeenCalledWith(
    CASE_ID,
    expect.objectContaining({
      status: 'archived',
      closedAt: expect.any(Date),
    }),
    { new: true, runValidators: true }
  );
  expect(mocks.caseFindByIdAndDelete).not.toHaveBeenCalled();
});

test('POST /api/case-assignments rejects endAt before startAt', async () => {
  const response = await jsonRequest('/api/case-assignments', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      userId: USER_ID,
      role: 'associate',
      startAt: '2026-05-20T10:00:00.000Z',
      endAt: '2026-05-19T10:00:00.000Z',
    }),
  });

  expect(response.status).toBe(400);
  expect(mocks.assignmentCreate).not.toHaveBeenCalled();
});

test('POST /api/case-assignments rejects duplicate active assignments', async () => {
  mocks.assignmentFindOne.mockResolvedValue({ _id: ASSIGNMENT_ID });

  const response = await jsonRequest('/api/case-assignments', {
    method: 'POST',
    body: JSON.stringify({
      caseId: CASE_ID,
      userId: USER_ID,
      role: 'associate',
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(409);
  expect(body.message).toBe('Active assignment already exists for this user and case');
  expect(mocks.assignmentCreate).not.toHaveBeenCalled();
});

test('GET /api/case-assignments/:id returns a single assignment', async () => {
  const query = queryResult({ _id: ASSIGNMENT_ID, caseId: CASE_ID, userId: USER_ID });
  mocks.assignmentFindById.mockReturnValue(query);

  const response = await jsonRequest(`/api/case-assignments/${ASSIGNMENT_ID}`);
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(mocks.assignmentFindById).toHaveBeenCalledWith(ASSIGNMENT_ID);
  expect(query.populate).toHaveBeenCalledWith('caseId', 'title status');
  expect(query.populate).toHaveBeenCalledWith('userId', 'name role email');
  expect(body.data._id).toBe(ASSIGNMENT_ID);
});

test('PUT /api/case-assignments/:id updates assignment fields with validators enabled', async () => {
  const response = await jsonRequest(`/api/case-assignments/${ASSIGNMENT_ID}`, {
    method: 'PUT',
    body: JSON.stringify({ role: 'primary', status: 'active' }),
  });

  expect(response.status).toBe(200);
  expect(mocks.assignmentFindByIdAndUpdate).toHaveBeenCalledWith(
    ASSIGNMENT_ID,
    { role: 'primary', status: 'active' },
    { new: true, runValidators: true }
  );
});
