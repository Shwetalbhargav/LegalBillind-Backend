import { createServer } from 'node:http';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { AUTH_COOKIE_NAME, signAuthToken } from '../modules/auth/services/authTokenService.js';

const mocks = vi.hoisted(() => ({
  rateCardFind: vi.fn(),
  rateCardFindById: vi.fn(),
  rateCardFindOne: vi.fn(),
  rateCardCreate: vi.fn(),
  rateCardFindByIdAndUpdate: vi.fn(),
  rateCardFindByIdAndDelete: vi.fn(),
  userExists: vi.fn(),
  userFindById: vi.fn(),
  caseExists: vi.fn(),
  partnerProfileFindOne: vi.fn(),
  lawyerProfileFindOne: vi.fn(),
  associateProfileFindOne: vi.fn(),
  internProfileFindOne: vi.fn(),
  firmFindById: vi.fn(),
}));

vi.mock('../modules/rates/models/RateCard.js', () => {
  const RateCard = {
    find: mocks.rateCardFind,
    findById: mocks.rateCardFindById,
    findOne: mocks.rateCardFindOne,
    create: mocks.rateCardCreate,
    findByIdAndUpdate: mocks.rateCardFindByIdAndUpdate,
    findByIdAndDelete: mocks.rateCardFindByIdAndDelete,
  };
  return { RateCard, default: RateCard };
});

vi.mock('../modules/users/models/User.js', () => ({
  default: {
    exists: mocks.userExists,
    findById: mocks.userFindById,
  },
}));

vi.mock('../modules/cases/models/Case.js', () => ({
  Case: {
    exists: mocks.caseExists,
  },
}));

vi.mock('../modules/users/models/PartnerProfile.js', () => ({
  default: {
    findOne: mocks.partnerProfileFindOne,
  },
}));

vi.mock('../modules/users/models/LawyerProfile.js', () => ({
  default: {
    findOne: mocks.lawyerProfileFindOne,
  },
}));

vi.mock('../modules/users/models/AssociateProfile.js', () => ({
  default: {
    findOne: mocks.associateProfileFindOne,
  },
}));

vi.mock('../modules/users/models/InternProfile.js', () => ({
  default: {
    findOne: mocks.internProfileFindOne,
  },
}));

vi.mock('../modules/firms/models/Firm.js', () => {
  const Firm = {
    findById: mocks.firmFindById,
  };
  return { Firm, default: Firm };
});

const { default: app } = await import('../app.js');

const USER_ID = '64b000000000000000000101';
const OTHER_USER_ID = '64b000000000000000000102';
const CASE_ID = '64b000000000000000000201';
const RATE_CARD_ID = '64b000000000000000000301';
const FIRM_ID = '64b000000000000000000401';

let server;
let baseUrl;

const authCookie = (role = 'admin', userId = USER_ID) =>
  `${AUTH_COOKIE_NAME}=${signAuthToken({ _id: userId, role, email: `${role}@example.com` })}`;

const jsonRequest = (path, options = {}, role = 'admin', userId = USER_ID) =>
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
    select: vi.fn(() => query),
    sort: vi.fn(() => query),
    session: vi.fn(() => query),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (reject) => Promise.resolve(result).catch(reject),
  };
  return query;
};

const rateCardDoc = (overrides = {}) => ({
  _id: RATE_CARD_ID,
  userId: USER_ID,
  caseId: CASE_ID,
  activityCode: 'L100',
  ratePerHour: 1200,
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  effectiveTo: null,
  ...overrides,
});

const createPayload = (overrides = {}) => ({
  userId: USER_ID,
  caseId: CASE_ID,
  activityCode: 'L100',
  ratePerHour: 1200,
  effectiveFrom: '2026-01-01',
  ...overrides,
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

  mocks.rateCardFind.mockReturnValue(queryResult([]));
  mocks.rateCardFindById.mockResolvedValue(rateCardDoc());
  mocks.rateCardFindOne.mockReturnValue(queryResult(null));
  mocks.rateCardCreate.mockImplementation(async (payload) => rateCardDoc(payload));
  mocks.rateCardFindByIdAndUpdate.mockImplementation(async (_id, update) => ({
    ...rateCardDoc(),
    ...update?.$set,
    ...(update?.$unset?.caseId ? { caseId: undefined } : {}),
    ...(update?.$unset?.activityCode ? { activityCode: undefined } : {}),
    ...(update?.$unset?.effectiveTo ? { effectiveTo: undefined } : {}),
  }));
  mocks.rateCardFindByIdAndDelete.mockResolvedValue(rateCardDoc());
  mocks.userExists.mockResolvedValue({ _id: USER_ID });
  mocks.userFindById.mockReturnValue(queryResult({ _id: USER_ID, role: 'lawyer', firmId: FIRM_ID }));
  mocks.caseExists.mockResolvedValue({ _id: CASE_ID });
  mocks.partnerProfileFindOne.mockReturnValue(queryResult(null));
  mocks.lawyerProfileFindOne.mockReturnValue(queryResult(null));
  mocks.associateProfileFindOne.mockReturnValue(queryResult(null));
  mocks.internProfileFindOne.mockReturnValue(queryResult(null));
  mocks.firmFindById.mockReturnValue(queryResult({ _id: FIRM_ID, billingPreferences: { defaultRate: 900 } }));
});

test('GET /api/rate-cards is admin-only', async () => {
  const response = await jsonRequest('/api/rate-cards', {}, 'lawyer');

  expect(response.status).toBe(403);
  expect(mocks.rateCardFind).not.toHaveBeenCalled();
});

test('GET /api/rate-cards validates query ObjectIds and activeOn', async () => {
  const response = await jsonRequest('/api/rate-cards?userId=bad&activeOn=not-a-date');
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.message).toBe('Validation failed');
  expect(mocks.rateCardFind).not.toHaveBeenCalled();
});

test('GET /api/rate-cards lists rate cards with validated filters', async () => {
  mocks.rateCardFind.mockReturnValueOnce(queryResult([rateCardDoc()]));

  const response = await jsonRequest(
    `/api/rate-cards?userId=${USER_ID}&caseId=${CASE_ID}&activityCode=L100&activeOn=2026-03-01`
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(mocks.rateCardFind).toHaveBeenCalledWith(expect.objectContaining({
    userId: USER_ID,
    caseId: CASE_ID,
    activityCode: 'L100',
    effectiveFrom: { $lte: expect.any(Date) },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: expect.any(Date) } }],
  }));
  expect(body).toHaveLength(1);
});

test('POST /api/rate-cards is admin-only', async () => {
  const response = await jsonRequest('/api/rate-cards', {
    method: 'POST',
    body: JSON.stringify(createPayload()),
  }, 'partner');

  expect(response.status).toBe(403);
  expect(mocks.rateCardCreate).not.toHaveBeenCalled();
});

test('POST /api/rate-cards rejects zero hourly rates', async () => {
  const response = await jsonRequest('/api/rate-cards', {
    method: 'POST',
    body: JSON.stringify(createPayload({ ratePerHour: 0 })),
  });

  expect(response.status).toBe(400);
  expect(mocks.rateCardCreate).not.toHaveBeenCalled();
});

test('POST /api/rate-cards rejects effectiveTo before effectiveFrom', async () => {
  const response = await jsonRequest('/api/rate-cards', {
    method: 'POST',
    body: JSON.stringify(createPayload({
      effectiveFrom: '2026-02-01',
      effectiveTo: '2026-01-01',
    })),
  });
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.error).toBe('effectiveTo must be greater than or equal to effectiveFrom');
  expect(mocks.rateCardCreate).not.toHaveBeenCalled();
});

test('POST /api/rate-cards validates referenced user and case exist', async () => {
  mocks.userExists.mockResolvedValueOnce(null);

  const missingUser = await jsonRequest('/api/rate-cards', {
    method: 'POST',
    body: JSON.stringify(createPayload()),
  });
  const missingUserBody = await missingUser.json();

  expect(missingUser.status).toBe(404);
  expect(missingUserBody.error).toBe('User not found');
  expect(mocks.rateCardCreate).not.toHaveBeenCalled();

  mocks.userExists.mockResolvedValueOnce({ _id: USER_ID });
  mocks.caseExists.mockResolvedValueOnce(null);

  const missingCase = await jsonRequest('/api/rate-cards', {
    method: 'POST',
    body: JSON.stringify(createPayload()),
  });
  const missingCaseBody = await missingCase.json();

  expect(missingCase.status).toBe(404);
  expect(missingCaseBody.error).toBe('Case not found');
  expect(mocks.rateCardCreate).not.toHaveBeenCalled();
});

test('POST /api/rate-cards rejects overlapping windows for the same specificity', async () => {
  mocks.rateCardFindOne.mockReturnValue(queryResult({ _id: '64b000000000000000000999' }));

  const response = await jsonRequest('/api/rate-cards', {
    method: 'POST',
    body: JSON.stringify(createPayload()),
  });
  const body = await response.json();

  expect(response.status).toBe(409);
  expect(body.error).toBe('A rate card already exists for this user, scope, and effective date window');
  expect(mocks.rateCardCreate).not.toHaveBeenCalled();
});

test('POST /api/rate-cards creates a normalized hourly rate card', async () => {
  const response = await jsonRequest('/api/rate-cards', {
    method: 'POST',
    body: JSON.stringify(createPayload({ activityCode: ' L100 ', effectiveTo: '' })),
  });
  const body = await response.json();

  expect(response.status).toBe(201);
  expect(mocks.rateCardCreate).toHaveBeenCalledWith(expect.objectContaining({
    userId: USER_ID,
    caseId: CASE_ID,
    activityCode: 'L100',
    ratePerHour: 1200,
    effectiveFrom: expect.any(Date),
  }));
  expect(mocks.rateCardCreate.mock.calls[0][0]).not.toHaveProperty('effectiveTo');
  expect(body.ratePerHour).toBe(1200);
});

test('GET /api/rate-cards/:id returns a single admin-readable rate card', async () => {
  const response = await jsonRequest(`/api/rate-cards/${RATE_CARD_ID}`);
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(mocks.rateCardFindById).toHaveBeenCalledWith(RATE_CARD_ID);
  expect(body._id).toBe(RATE_CARD_ID);
});

test('PUT /api/rate-cards/:id updates rate cards and normalizes optional empty fields', async () => {
  const response = await jsonRequest(`/api/rate-cards/${RATE_CARD_ID}`, {
    method: 'PUT',
    body: JSON.stringify({
      activityCode: '',
      effectiveTo: '',
      ratePerHour: 1300,
    }),
  });

  expect(response.status).toBe(200);
  expect(mocks.rateCardFindByIdAndUpdate).toHaveBeenCalledWith(
    RATE_CARD_ID,
    {
      $set: { ratePerHour: 1300 },
      $unset: { activityCode: 1, effectiveTo: 1 },
    },
    { new: true, runValidators: true }
  );
});

test('PUT and DELETE /api/rate-cards/:id validate id params', async () => {
  const update = await jsonRequest('/api/rate-cards/not-an-id', {
    method: 'PUT',
    body: JSON.stringify({ ratePerHour: 1300 }),
  });
  const remove = await jsonRequest('/api/rate-cards/not-an-id', {
    method: 'DELETE',
  });

  expect(update.status).toBe(400);
  expect(remove.status).toBe(400);
  expect(mocks.rateCardFindByIdAndUpdate).not.toHaveBeenCalled();
  expect(mocks.rateCardFindByIdAndDelete).not.toHaveBeenCalled();
});

test('PUT /api/rate-cards/:id validates new references before update', async () => {
  mocks.caseExists.mockResolvedValueOnce(null);

  const response = await jsonRequest(`/api/rate-cards/${RATE_CARD_ID}`, {
    method: 'PUT',
    body: JSON.stringify({ caseId: CASE_ID }),
  });
  const body = await response.json();

  expect(response.status).toBe(404);
  expect(body.error).toBe('Case not found');
  expect(mocks.rateCardFindByIdAndUpdate).not.toHaveBeenCalled();
});

test('DELETE /api/rate-cards/:id deletes an admin-owned rate card record', async () => {
  const response = await jsonRequest(`/api/rate-cards/${RATE_CARD_ID}`, {
    method: 'DELETE',
  });
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body).toEqual({ success: true });
  expect(mocks.rateCardFindByIdAndDelete).toHaveBeenCalledWith(RATE_CARD_ID);
});

test('GET /api/rate-cards/resolve blocks non-admin resolution for other users', async () => {
  const response = await jsonRequest(
    `/api/rate-cards/resolve?userId=${OTHER_USER_ID}`,
    {},
    'lawyer',
    USER_ID
  );

  expect(response.status).toBe(403);
  expect(mocks.rateCardFindOne).not.toHaveBeenCalled();
});

test('GET /api/rate-cards/resolve applies specific-to-generic rate-card fallback queries', async () => {
  const response = await jsonRequest(
    `/api/rate-cards/resolve?userId=${USER_ID}&caseId=${CASE_ID}&activityCode=L100&at=2026-03-01`,
    {},
    'partner'
  );
  const body = await response.json();
  const [exact, userCase, userActivity, userOnly] = mocks.rateCardFindOne.mock.calls.map(([query]) => query);

  expect(response.status).toBe(200);
  expect(body.sourceType).toBe('firm');
  expect(exact).toEqual(expect.objectContaining({
    caseId: expect.any(Object),
    activityCode: 'L100',
  }));
  expect(userCase).toEqual(expect.objectContaining({ caseId: expect.any(Object) }));
  expect(userCase).not.toHaveProperty('activityCode');
  expect(JSON.stringify(userCase.$and)).toContain('activityCode');
  expect(userActivity).toEqual(expect.objectContaining({ activityCode: 'L100' }));
  expect(userActivity).not.toHaveProperty('caseId');
  expect(JSON.stringify(userActivity.$and)).toContain('caseId');
  expect(userOnly).not.toHaveProperty('caseId');
  expect(userOnly).not.toHaveProperty('activityCode');
  expect(JSON.stringify(userOnly.$and)).toContain('caseId');
  expect(JSON.stringify(userOnly.$and)).toContain('activityCode');
});

test('GET /api/rate-cards/resolve falls back to intern profile billingRate', async () => {
  mocks.userFindById.mockReturnValue(queryResult({ _id: USER_ID, role: 'intern', firmId: FIRM_ID }));
  mocks.internProfileFindOne.mockReturnValue(queryResult({ _id: 'profile1', userId: USER_ID, billingRate: 750 }));

  const response = await jsonRequest(`/api/rate-cards/resolve?userId=${USER_ID}`, {}, 'admin');
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body).toEqual(expect.objectContaining({
    ratePerHour: 750,
    sourceType: 'profile',
  }));
  expect(mocks.internProfileFindOne).toHaveBeenCalledWith({ userId: expect.any(Object) });
  expect(mocks.firmFindById).not.toHaveBeenCalled();
});
