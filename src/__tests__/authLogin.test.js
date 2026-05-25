import { createServer } from 'node:http';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';

const findOne = vi.fn();
const findById = vi.fn();

vi.mock('../modules/users/models/User.js', () => ({
  default: {
    findOne,
    findById,
  },
}));

const { default: app } = await import('../app.js');
const { AUTH_COOKIE_NAME, signAuthToken } = await import('../modules/auth/services/authTokenService.js');

let server;
let baseUrl;
const FIRM_ID = '507f1f77bcf86cd799439012';

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
  findOne.mockReset();
  findById.mockReset();
});

test('POST /api/auth/login returns the user and auth cookie for valid credentials', async () => {
  const passwordHash = await bcrypt.hash('correct-password', 10);
  const user = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Asha Partner',
    email: 'asha@example.com',
    mobile: '9876543210',
    role: 'partner',
    firmId: FIRM_ID,
    address: 'Mumbai',
    qualifications: [{ degree: 'LLB', university: 'Mumbai University', year: 2015 }],
    passwordHash,
  };

  findOne.mockResolvedValue(user);

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Asha Partner',
      mobile: '9876543210',
      password: 'correct-password',
      role: 'partner',
      firmId: FIRM_ID,
    }),
  });

  const body = await response.json();

  expect(response.status).toBe(200);
  expect(response.headers.get('set-cookie')).toContain(`${AUTH_COOKIE_NAME}=`);
  expect(findOne).toHaveBeenCalledWith({
    mobile: '9876543210',
    role: 'partner',
    firmId: FIRM_ID,
  });
  expect(body).toMatchObject({
    success: true,
    user: {
      id: '507f1f77bcf86cd799439011',
      name: 'Asha Partner',
      mobile: '9876543210',
      role: 'partner',
      address: 'Mumbai',
      qualifications: [{ degree: 'LLB', university: 'Mumbai University', year: 2015 }],
    },
  });
});

test('POST /api/auth/login rejects requests missing a required field', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Asha Partner',
      mobile: '9876543210',
      role: 'partner',
      firmId: FIRM_ID,
    }),
  });

  const body = await response.json();

  expect(response.status).toBe(400);
  expect(findOne).not.toHaveBeenCalled();
  expect(body).toMatchObject({
    ok: false,
    message: 'Validation failed',
  });
  expect(body.errors).toContainEqual({
    field: 'password',
    message: 'password is required',
  });
});

test('GET /api/auth/me returns the same safe user from the auth cookie', async () => {
  const user = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Asha Partner',
    email: 'asha@example.com',
    mobile: '9876543210',
    role: 'partner',
    firmId: FIRM_ID,
    photoUrl: '/images/default-user.jpg',
    address: 'Mumbai',
    qualifications: [{ degree: 'LLB', university: 'Mumbai University', year: 2015 }],
    passwordHash: 'hidden',
  };
  const token = signAuthToken(user);

  findById.mockResolvedValue(user);

  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      cookie: `${AUTH_COOKIE_NAME}=${token}`,
    },
  });

  const body = await response.json();

  expect(response.status).toBe(200);
  expect(findById).toHaveBeenCalledWith(user._id);
  expect(body).toMatchObject({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      firmId: FIRM_ID,
      photoUrl: user.photoUrl,
      address: user.address,
      qualifications: user.qualifications,
    },
  });
  expect(body.user.passwordHash).toBeUndefined();
});
