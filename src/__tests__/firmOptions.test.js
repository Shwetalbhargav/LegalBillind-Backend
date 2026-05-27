import { createServer } from 'node:http';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';

const firmFind = vi.fn();

vi.mock('../modules/firms/models/Firm.js', () => {
  const Firm = { find: firmFind };
  return { Firm, default: Firm };
});

const { default: app } = await import('../app.js');

let server;
let baseUrl;

const queryResult = (result) => {
  const query = {
    sort: vi.fn(() => Promise.resolve(result)),
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
  firmFind.mockReset();
});

test('GET /api/firms/options is available without an auth cookie', async () => {
  firmFind.mockReturnValue(queryResult([{ _id: '64b000000000000000000002', name: 'Harmon & Associates' }]));

  const response = await fetch(`${baseUrl}/api/firms/options`);
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(firmFind).toHaveBeenCalledWith({}, { name: 1 });
  expect(body).toMatchObject({
    ok: true,
    data: [{ _id: '64b000000000000000000002', name: 'Harmon & Associates' }],
  });
});
