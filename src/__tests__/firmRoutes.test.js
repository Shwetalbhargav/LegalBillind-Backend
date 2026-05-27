import { createServer } from 'node:http';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { AUTH_COOKIE_NAME, signAuthToken } from '../modules/auth/services/authTokenService.js';

const mocks = vi.hoisted(() => ({
  firmFind: vi.fn(),
  firmFindOne: vi.fn(),
  firmFindById: vi.fn(),
  firmCreate: vi.fn(),
  firmFindByIdAndUpdate: vi.fn(),
  firmFindByIdAndDelete: vi.fn(),
  userCountDocuments: vi.fn(),
  adminCountDocuments: vi.fn(),
  clientCountDocuments: vi.fn(),
  caseAssignmentCountDocuments: vi.fn(),
}));

vi.mock('../modules/firms/models/Firm.js', () => {
  const Firm = {
    find: mocks.firmFind,
    findOne: mocks.firmFindOne,
    findById: mocks.firmFindById,
    create: mocks.firmCreate,
    findByIdAndUpdate: mocks.firmFindByIdAndUpdate,
    findByIdAndDelete: mocks.firmFindByIdAndDelete,
  };
  return { Firm, default: Firm };
});

vi.mock('../modules/users/models/User.js', () => ({
  default: {
    countDocuments: mocks.userCountDocuments,
  },
}));

vi.mock('../modules/users/models/admin.js', () => ({
  default: {
    countDocuments: mocks.adminCountDocuments,
  },
}));

vi.mock('../modules/clients/models/Client.js', () => ({
  Client: {
    countDocuments: mocks.clientCountDocuments,
  },
  default: {
    countDocuments: mocks.clientCountDocuments,
  },
}));

vi.mock('../modules/cases/models/CaseAssignment.js', () => ({
  CaseAssignment: {
    countDocuments: mocks.caseAssignmentCountDocuments,
  },
  default: {
    countDocuments: mocks.caseAssignmentCountDocuments,
  },
}));

const { default: app } = await import('../app.js');

const FIRM_ID = '64b000000000000000000002';
const USER_ID = '64b000000000000000000003';

let server;
let baseUrl;

const queryResult = (result) => {
  const query = {
    select: vi.fn(() => query),
    sort: vi.fn(() => query),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (reject) => Promise.resolve(result).catch(reject),
  };
  return query;
};

const authCookie = (role = 'admin') =>
  `${AUTH_COOKIE_NAME}=${signAuthToken({ _id: USER_ID, role, email: 'admin@example.com' })}`;

const jsonRequest = (path, options = {}, role = 'admin') =>
  fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      cookie: authCookie(role),
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

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
  mocks.firmFindOne.mockReturnValue(queryResult(null));
  mocks.userCountDocuments.mockResolvedValue(0);
  mocks.adminCountDocuments.mockResolvedValue(0);
  mocks.clientCountDocuments.mockResolvedValue(0);
  mocks.caseAssignmentCountDocuments.mockResolvedValue(0);
});

test('GET /api/firms/options is public and returns stable id fields', async () => {
  mocks.firmFind.mockReturnValue(queryResult([{ _id: FIRM_ID, name: 'Harmon & Associates' }]));

  const response = await fetch(`${baseUrl}/api/firms/options`);
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(mocks.firmFind).toHaveBeenCalledWith({}, { name: 1 });
  expect(body.data).toEqual([
    {
      _id: FIRM_ID,
      id: FIRM_ID,
      name: 'Harmon & Associates',
    },
  ]);
});

test('GET /api/firms/:firmId rejects invalid ids before hitting the database', async () => {
  const response = await jsonRequest('/api/firms/not-a-valid-id');
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body).toMatchObject({ ok: false, message: 'Validation failed' });
  expect(mocks.firmFindById).not.toHaveBeenCalled();
});

test('POST /api/firms rejects unknown payload fields', async () => {
  const response = await jsonRequest('/api/firms', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Harmon & Associates',
      tagline: 'Not part of the API payload',
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.errors).toContainEqual({ field: 'tagline', message: 'tagline is not allowed' });
  expect(mocks.firmCreate).not.toHaveBeenCalled();
});

test('POST /api/firms normalizes accepted payload fields', async () => {
  mocks.firmCreate.mockImplementation(async (payload) => ({ _id: FIRM_ID, ...payload }));

  const response = await jsonRequest('/api/firms', {
    method: 'POST',
    body: JSON.stringify({
      name: '  Harmon & Associates  ',
      currency: 'inr',
      taxSettings: { taxName: ' GST ', taxRatePct: '18', inclusive: 'false' },
      address: { city: ' New Delhi ', country: 'in' },
      billingPreferences: { defaultRate: '2500', autoSync: 'false' },
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(201);
  expect(mocks.firmCreate).toHaveBeenCalledWith({
    name: 'Harmon & Associates',
    currency: 'INR',
    taxSettings: { taxName: 'GST', taxRatePct: 18, inclusive: false },
    address: { city: 'New Delhi', country: 'IN' },
    billingPreferences: { defaultRate: 2500, autoSync: false },
  });
  expect(body.data).toMatchObject({ id: FIRM_ID, name: 'Harmon & Associates' });
});

test('POST /api/firms rejects duplicate firm names case-insensitively', async () => {
  mocks.firmFindOne.mockReturnValue(queryResult({ _id: FIRM_ID, name: 'Harmon & Associates' }));

  const response = await jsonRequest('/api/firms', {
    method: 'POST',
    body: JSON.stringify({
      name: 'harmon & associates',
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.errors).toContainEqual({
    field: 'name',
    message: 'A firm with this name already exists',
  });
  expect(mocks.firmCreate).not.toHaveBeenCalled();
});

test('PUT /api/firms/:firmId updates nested settings without replacing siblings', async () => {
  mocks.firmFindByIdAndUpdate.mockResolvedValue({
    _id: FIRM_ID,
    taxSettings: { taxName: 'GST', taxRatePct: 18, inclusive: false },
  });

  const response = await jsonRequest(`/api/firms/${FIRM_ID}`, {
    method: 'PUT',
    body: JSON.stringify({
      taxSettings: { taxRatePct: 12 },
    }),
  });

  expect(response.status).toBe(200);
  expect(mocks.firmFindByIdAndUpdate).toHaveBeenCalledWith(
    FIRM_ID,
    { $set: { 'taxSettings.taxRatePct': 12 } },
    { new: true, runValidators: true }
  );
});

test('PATCH /api/firms/:firmId/billing-preferences rejects empty payloads', async () => {
  const response = await jsonRequest(`/api/firms/${FIRM_ID}/billing-preferences`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });

  expect(response.status).toBe(400);
  expect(mocks.firmFindByIdAndUpdate).not.toHaveBeenCalled();
});

test('DELETE /api/firms/:firmId blocks hard delete when related records exist', async () => {
  mocks.firmFindById.mockReturnValue(queryResult({ _id: FIRM_ID }));
  mocks.userCountDocuments.mockResolvedValue(2);
  mocks.clientCountDocuments.mockResolvedValue(1);

  const response = await jsonRequest(`/api/firms/${FIRM_ID}`, { method: 'DELETE' });
  const body = await response.json();

  expect(response.status).toBe(409);
  expect(body.details).toEqual({
    users: 2,
    admins: 0,
    clients: 1,
    caseAssignments: 0,
  });
  expect(mocks.firmFindByIdAndDelete).not.toHaveBeenCalled();
});
