import { MatterDocument } from '../models/MatterDocument.js';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'will', 'what', 'when',
  'where', 'which', 'there', 'their', 'about', 'into', 'your', 'case', 'matter',
]);

export function summarizeText(content = '', maxSentences = 3) {
  const sentences = String(content)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return sentences.slice(0, maxSentences).join(' ').slice(0, 2000) || String(content).slice(0, 500);
}

function tokens(value = '') {
  return String(value)
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g)
    ?.filter((word) => !STOP_WORDS.has(word)) || [];
}

function scoreDocument(doc, queryTokens) {
  const haystack = `${doc.title} ${doc.summary || ''} ${doc.content}`.toLowerCase();
  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

export async function retrieveMatterDocuments({ caseId, question, limit = 4 }) {
  const docs = await MatterDocument.find({ caseId }).sort({ createdAt: -1 }).limit(50).lean();
  const queryTokens = tokens(question);
  const ranked = docs
    .map((doc) => ({ doc, score: scoreDocument(doc, queryTokens) }))
    .filter((item) => item.score > 0 || queryTokens.length === 0)
    .sort((a, b) => b.score - a.score || new Date(b.doc.createdAt) - new Date(a.doc.createdAt))
    .slice(0, limit)
    .map((item) => item.doc);
  return ranked.length ? ranked : docs.slice(0, limit);
}

export function buildMatterAnswer({ question, documents }) {
  if (!documents.length) {
    return {
      answer: 'No matter documents are indexed yet. Add source documents or notes before asking matter-specific questions.',
      citations: [],
    };
  }
  const citations = documents.map((doc) => ({
    documentId: String(doc._id),
    title: doc.title,
    documentType: doc.documentType,
    excerpt: (doc.summary || doc.content || '').slice(0, 500),
  }));
  const answer = [
    `Matter answer for: ${question}`,
    '',
    ...citations.map((cite, index) => `${index + 1}. ${cite.title}: ${cite.excerpt}`),
    '',
    'Use the cited matter documents above as the review trail before relying on this answer.',
  ].join('\n');
  return { answer, citations };
}

export function buildGeneratedDocument({ documentType, instructions, sourceDocuments }) {
  const title = `${documentType || 'Legal'} Draft`;
  const sourceSummary = sourceDocuments
    .map((doc, index) => `${index + 1}. ${doc.title}: ${doc.summary || summarizeText(doc.content, 1)}`)
    .join('\n');
  const body = [
    title,
    '',
    'Purpose',
    instructions,
    '',
    'Relevant Matter Material',
    sourceSummary || 'No source documents were available for this matter.',
    '',
    'Draft',
    `This ${documentType || 'document'} is prepared based on the instructions and the indexed matter material. Review facts, citations, dates, party names, and filing requirements before external use.`,
    '',
    'Action Items',
    '- Verify procedural dates and limitation risk.',
    '- Confirm client approvals and supporting documents.',
    '- Update the draft with jurisdiction-specific formatting before filing or sending.',
  ].join('\n');
  return { title, content: body };
}
