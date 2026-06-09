import { expect, test } from 'vitest';
import {
  buildGeneratedDocument,
  buildMatterAnswer,
  summarizeText,
} from '../modules/ai/services/matterDocumentService.js';

test('summarizeText returns a short document summary', () => {
  const summary = summarizeText('First sentence. Second sentence. Third sentence. Fourth sentence.', 2);
  expect(summary).toBe('First sentence. Second sentence.');
});

test('buildMatterAnswer returns citations for retrieved matter documents', () => {
  const result = buildMatterAnswer({
    question: 'What is the next hearing issue?',
    documents: [
      {
        _id: '000000000000000000000001',
        title: 'Hearing Note',
        documentType: 'note',
        summary: 'The next hearing concerns interim relief.',
      },
    ],
  });

  expect(result.answer).toContain('Matter answer');
  expect(result.citations).toHaveLength(1);
  expect(result.citations[0].title).toBe('Hearing Note');
});

test('buildGeneratedDocument creates a draft with source material', () => {
  const generated = buildGeneratedDocument({
    documentType: 'brief',
    instructions: 'Prepare a short brief on interim relief.',
    sourceDocuments: [
      { title: 'Client Facts', summary: 'Client needs urgent injunction.' },
    ],
  });

  expect(generated.title).toBe('brief Draft');
  expect(generated.content).toContain('Client Facts');
  expect(generated.content).toContain('Prepare a short brief');
});
