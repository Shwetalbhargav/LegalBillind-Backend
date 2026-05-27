import { expect, test } from 'vitest';
import { EmailEntry } from '../modules/emailEntries/models/EmailEntry.js';

test('EmailEntry supports idempotent source metadata and lifecycle defaults', async () => {
  const entry = new EmailEntry({
    userId: '000000000000000000000001',
    userEmail: 'lawyer@example.com',
    recipient: 'research.example.com',
    subject: 'Research capture',
    typingTimeMinutes: 6,
    source: 'research',
    sourceRef: 'research:example.com:abc123',
    url: 'https://research.example.com/article',
    domain: 'research.example.com',
  });

  await expect(entry.validate()).resolves.toBeUndefined();
  expect(entry.status).toBe('captured');
  expect(entry.schemaVersion).toBe(1);
  expect(entry.sourceRef).toBe('research:example.com:abc123');

  const indexes = EmailEntry.schema.indexes();
  expect(indexes.some(([fields, options]) =>
    fields.userId === 1 &&
    fields.source === 1 &&
    fields.sourceRef === 1 &&
    options?.unique === true
  )).toBe(true);
});

test('EmailEntry rejects unsupported sources and statuses', async () => {
  const entry = new EmailEntry({
    recipient: 'client@example.com',
    subject: 'Client update',
    typingTimeMinutes: 3,
    source: 'calendar',
    status: 'pending',
  });

  await expect(entry.validate()).rejects.toThrow(/calendar|pending/);
});
