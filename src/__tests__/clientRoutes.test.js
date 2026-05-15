import { createServer } from 'node:http';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { AUTH_COOKIE_NAME, signAuthToken } from '../modules/auth/services/authTokenService.js';

const mocks = vi.hoisted(() => ({
  clientFind: vi.fn(),
  clientFindById: vi.fn(),
  clientCreate: vi.fn(),
  clientFindByIdAndUpdate: vi.fn(),
  clientFindByIdAndDelete: vi.fn(),
  clientExists: vi.fn(),
  clientCountDocuments: vi.fn(),
  caseFind: vi.fn(),
  caseCountDocuments: vi.fn(),
  invoiceFind: vi.fn(),
  invoiceCountDocuments: vi.fn(),
  paymentFind: vi.fn(),
  paymentCountDocuments: vi.fn(),
  timeEntryFind: vi.fn(),
  timeEntryCountDocuments: vi.fn(),
  firmExists: vi.fn(),
  userExists: vi.fn(),
}));

vi.mock('../modules/clients/models/Client.js', () => {
  const Client = {
    find: mocks.clientFind,
    findById: mocks.clientFindById,
    create: mocks.clientCreate,
    findByIdAndUpdate: mocks.clientFindByIdAndUpdate,
    findByIdAndDelete: mocks.clientFindByIdAndDelete,
    exists: mocks.clientExists,
    countDocuments: mocks.clientCountDocuments,
  };
  return { Client, default: Client };
});

vi.mock('../modules/cases/models/Case.js', () => ({
  Case: {
    find: mocks.caseFind,
    countDocuments: mocks.caseCountDocuments,
  },
}));

vi.mock('../modules/invoices/models/Invoice.js', () => ({
  Invoice: {
    find: mocks.invoiceFind,
    countDocuments: mocks.invoiceCountDocuments,
  },
}));

vi.mock('../modules/payments/models/Payment.js', () => ({
  Payment: {
    find: mocks.paymentFind,
    countDocuments: mocks.paymentCountDocuments,
  },
}));

vi.mock('../modules/timeEntries/models/TimeEntry.js', () => ({
  TimeEntry: {
    find: mocks.timeEntryFind,
    countDocuments: mocks.timeEntryCountDocuments,
  },
}));

vi.mock('../modules/firms/models/Firm.js', () => ({
  Firm: {
    exists: mocks.firmExists,
  },
}));

vi.mock('../modules/users/models/User.js', () => ({
  default: {
    exists: mocks.userExists,
  },
}));

const { default: app } = await import('../app.js');

const CLIENT_ID = '64b000000000000000000001';
const FIRM_ID = '64b000000000000000000002';
const USER_ID = '64b000000000000000000003';
const INVOICE_ID = '64b000000000000000000004';

let server;
let baseUrl;

const authCookie = () =>
  `${AUTH_COOKIE_NAME}=${signAuthToken({ _id: USER_ID, role: 'admin', email: 'admin@example.com' })}`;

const jsonRequest = (path, options = {}) =>
  fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      cookie: authCookie(),
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
  mocks.firmExists.mockResolvedValue({ _id: FIRM_ID });
  mocks.userExists.mockResolvedValue({ _id: USER_ID });
  mocks.clientExists.mockResolvedValue({ _id: CLIENT_ID });
});

test('GET /api/clients/:clientId rejects invalid client ids before hitting the database', async () => {
  const response = await jsonRequest('/api/clients/not-a-valid-id');
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body).toMatchObject({ ok: false, message: 'Validation failed' });
  expect(mocks.clientFindById).not.toHaveBeenCalled();
});

test('POST /api/clients rejects unknown client payload fields', async () => {
  const response = await jsonRequest('/api/clients', {
    method: 'POST',
    body: JSON.stringify({
      displayName: 'Nimbus Retail',
      contacts: [],
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.errors).toContainEqual({ field: 'contacts', message: 'contacts is not allowed' });
  expect(mocks.clientCreate).not.toHaveBeenCalled();
});

test('POST /api/clients normalizes accepted payload fields and validates references', async () => {
  mocks.clientCreate.mockImplementation(async (payload) => ({ _id: CLIENT_ID, ...payload }));

  const response = await jsonRequest('/api/clients', {
    method: 'POST',
    body: JSON.stringify({
      displayName: '  Nimbus Retail  ',
      email: 'CLIENT@EXAMPLE.COM ',
      phone: ' +91 99999 ',
      firmId: FIRM_ID,
      ownerUserId: USER_ID,
      paymentTerms: 'net30',
      status: 'Prospect',
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(201);
  expect(mocks.firmExists).toHaveBeenCalledWith({ _id: FIRM_ID });
  expect(mocks.userExists).toHaveBeenCalledWith({ _id: USER_ID });
  expect(mocks.clientCreate).toHaveBeenCalledWith({
    displayName: 'Nimbus Retail',
    email: 'client@example.com',
    phone: '+91 99999',
    firmId: FIRM_ID,
    ownerUserId: USER_ID,
    paymentTerms: 'NET30',
    status: 'prospect',
  });
  expect(body.data.displayName).toBe('Nimbus Retail');
});

test('POST /api/clients rejects missing referenced firms', async () => {
  mocks.firmExists.mockResolvedValue(null);

  const response = await jsonRequest('/api/clients', {
    method: 'POST',
    body: JSON.stringify({
      displayName: 'Nimbus Retail',
      firmId: FIRM_ID,
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.errors).toContainEqual({
    field: 'firmId',
    message: 'firmId does not reference an existing firm',
  });
  expect(mocks.clientCreate).not.toHaveBeenCalled();
});

test('PUT /api/clients/:clientId rejects empty update payloads', async () => {
  const response = await jsonRequest(`/api/clients/${CLIENT_ID}`, {
    method: 'PUT',
    body: JSON.stringify({}),
  });

  expect(response.status).toBe(400);
  expect(mocks.clientFindByIdAndUpdate).not.toHaveBeenCalled();
});

test('PUT /api/clients/:clientId validates enum fields before updating', async () => {
  const response = await jsonRequest(`/api/clients/${CLIENT_ID}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'archived' }),
  });

  expect(response.status).toBe(400);
  expect(mocks.clientFindByIdAndUpdate).not.toHaveBeenCalled();
});

test('PUT /api/clients/:clientId runs mongoose validators during updates', async () => {
  mocks.clientFindByIdAndUpdate.mockResolvedValue({ _id: CLIENT_ID, displayName: 'Nimbus Retail' });

  const response = await jsonRequest(`/api/clients/${CLIENT_ID}`, {
    method: 'PUT',
    body: JSON.stringify({ displayName: ' Nimbus Retail ' }),
  });
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(mocks.clientFindByIdAndUpdate).toHaveBeenCalledWith(
    CLIENT_ID,
    { displayName: 'Nimbus Retail' },
    { new: true, runValidators: true }
  );
  expect(body.data.displayName).toBe('Nimbus Retail');
});

test('PATCH /api/clients/:clientId/assign-owner clears owner when ownerUserId is null', async () => {
  mocks.clientFindByIdAndUpdate.mockReturnValue(queryResult({ _id: CLIENT_ID, ownerUserId: null }));

  const response = await jsonRequest(`/api/clients/${CLIENT_ID}/assign-owner`, {
    method: 'PATCH',
    body: JSON.stringify({ ownerUserId: null }),
  });

  expect(response.status).toBe(200);
  expect(mocks.userExists).not.toHaveBeenCalled();
  expect(mocks.clientFindByIdAndUpdate).toHaveBeenCalledWith(
    CLIENT_ID,
    { ownerUserId: null },
    { new: true, runValidators: true }
  );
});

test('DELETE /api/clients/:clientId blocks hard delete when related records exist', async () => {
  mocks.clientFindById.mockReturnValue(queryResult({ _id: CLIENT_ID }));
  mocks.caseCountDocuments.mockResolvedValue(1);
  mocks.invoiceFind.mockReturnValue(queryResult([{ _id: INVOICE_ID }]));
  mocks.timeEntryCountDocuments.mockResolvedValue(2);
  mocks.paymentCountDocuments.mockResolvedValue(3);

  const response = await jsonRequest(`/api/clients/${CLIENT_ID}`, { method: 'DELETE' });
  const body = await response.json();

  expect(response.status).toBe(409);
  expect(body.details).toEqual({
    cases: 1,
    invoices: 1,
    timeEntries: 2,
    payments: 3,
  });
  expect(mocks.clientFindByIdAndDelete).not.toHaveBeenCalled();
});

test('GET /api/clients/:clientId/cases returns 404 when the client does not exist', async () => {
  mocks.clientExists.mockResolvedValue(null);

  const response = await jsonRequest(`/api/clients/${CLIENT_ID}/cases`);

  expect(response.status).toBe(404);
  expect(mocks.caseFind).not.toHaveBeenCalled();
});

test('GET /api/clients supports filtering and pagination', async () => {
  const query = queryResult([{ _id: CLIENT_ID, displayName: 'Nimbus Retail' }]);
  mocks.clientFind.mockReturnValue(query);
  mocks.clientCountDocuments.mockResolvedValue(1);

  const response = await jsonRequest(
    `/api/clients?page=2&limit=10&status=active&ownerUserId=${USER_ID}&q=Nimbus`
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(mocks.clientFind).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 'active',
      ownerUserId: USER_ID,
      $or: expect.any(Array),
    })
  );
  expect(query.skip).toHaveBeenCalledWith(10);
  expect(query.limit).toHaveBeenCalledWith(10);
  expect(body.meta).toEqual({
    page: 2,
    limit: 10,
    total: 1,
    totalPages: 1,
  });
});
