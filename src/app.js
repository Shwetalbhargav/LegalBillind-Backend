import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import connectDB from './config/db.js';

// ROUTES
import clioSyncRoutes from './routes/clioSync.js';
import emailEntryRoutes from './routes/emailEntry.js';
import clioAuthRoutes from './routes/clioAuth.js';
import authRoutes from './routes/authRoutes.js';
import billableRoutes from './routes/billableRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import teamAssignmentRoutes from './routes/teamAssignmentRoutes.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);

// --- DB
connectDB();

// --- CORS (allow vercel previews + explicit allowlist)
const allowlist = new Set([
  'chrome-extension://loicakonhdggeejichcfpgagooapmdek',
  'https://mail.google.com',
  'http://localhost:5173',
  'http://localhost:5000',
  process.env.FRONTEND_URL,
]);

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowlist.has(origin)) return cb(null, true);
    if (/\.vercel\.app$/.test(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.options('*', cors({ origin: true, credentials: true }));

// --- ROUTE MOUNTS (ALL **PATHS**, no URLs)
app.use('/api/email-entry', emailEntryRoutes);
app.use('/api/billables', billableRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/clio-sync', clioSyncRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/team-assignments', teamAssignmentRoutes);
app.use('/clio', clioAuthRoutes);

// --- utility endpoint
app.post('/generate-email', async (req, res) => {
  try {
    const prompt = req?.body?.prompt;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || 'llama3-70b-8192';
    if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 512,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that writes concise, formal legal emails suitable for billing summaries.' },
          { role: 'user', content: `Write a formal legal email.\n\nPrompt: ${prompt}` },
        ],
      }),
    });

    const raw = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: 'Groq error', details: raw });

    let json = {};
    try { json = JSON.parse(raw); } catch {
      return res.status(502).json({ error: 'Invalid JSON from Groq' });
    }

    const email = json?.choices?.[0]?.message?.content?.trim() || '';
    if (!email) return res.status(502).json({ error: 'No text returned by Groq' });

    res.json({ email });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

export default app;
